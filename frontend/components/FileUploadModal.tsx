'use client';

import { useState, useRef } from 'react';
import { encryptFile, exportKey, calculateFileHash } from '@/lib/encryption';
import { storage } from '@/lib/storage';
import { blockchainAPI } from '@/lib/blockchain-api';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RECORD_TYPES = [
  { value: 0, label: '📄 General', color: 'blue' },
  { value: 1, label: '🧪 Lab Result', color: 'green' },
  { value: 2, label: '🩻 Imaging (X-ray, MRI)', color: 'purple' },
  { value: 3, label: '💊 Prescription', color: 'pink' },
  { value: 4, label: '🏥 Diagnosis', color: 'red' },
  { value: 5, label: '📋 Other', color: 'gray' },
];

export default function FileUploadModal({ isOpen, onClose, onSuccess }: FileUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [recordType, setRecordType] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!description.trim()) {
      setError('Please add a description');
      return;
    }

    if (description.length > 100) {
      setError('Description must be 100 characters or less');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setProgress(10);

      const walletAddress = storage.getAddress();
      const token = storage.getToken();

      if (!walletAddress || !token) {
        throw new Error('Not authenticated');
      }

      // Step 1: Calculate file hash for integrity
      setProgress(20);
      const fileHash = await calculateFileHash(file);
      console.log('File hash:', fileHash);

      // Step 2: Encrypt file
      setProgress(30);
      const { encryptedData, key, originalFileName, originalFileType } = await encryptFile(file);
      console.log('File encrypted');

      // Step 3: Create encrypted file blob
      setProgress(40);
      const encryptedBlob = new Blob(
        [JSON.stringify({
          version: '1.0',
          encrypted: true,
          algorithm: 'AES-GCM-256',
          ciphertext: encryptedData.ciphertext,
          iv: encryptedData.iv,
          salt: encryptedData.salt,
          originalFileName,
          originalFileType,
          originalFileSize: file.size,
          encryptedAt: new Date().toISOString(),
        })],
        { type: 'application/json' }
      );

      // Step 4: Upload encrypted file to IPFS
      setProgress(50);
      const fileFormData = new FormData();
      fileFormData.append('file', encryptedBlob, `encrypted-${originalFileName}.json`);
      fileFormData.append('metadata', JSON.stringify({
        name: `health-record-${Date.now()}`,
        type: 'encrypted-health-record',
      }));

      const fileUploadRes = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fileFormData,
      });

      if (!fileUploadRes.ok) {
        const errorData = await fileUploadRes.json();
        throw new Error(errorData.error || 'Failed to upload file to IPFS');
      }

      const { cid: dataCID } = await fileUploadRes.json();
      console.log('File uploaded to IPFS:', dataCID);

      // Step 5: Export encryption key
      setProgress(60);
      const keyString = await exportKey(key);

      // Step 6: Upload encryption key to IPFS (encrypted for owner)
      setProgress(70);
      const keyData = {
        encryptedFor: walletAddress,
        key: keyString,
        algorithm: 'AES-GCM-256',
        createdAt: new Date().toISOString(),
      };

      const keyUploadRes = await fetch('/api/ipfs/upload-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: keyData,
          metadata: {
            name: `encryption-key-${Date.now()}`,
            type: 'encryption-key',
          },
        }),
      });

      if (!keyUploadRes.ok) {
        throw new Error('Failed to upload encryption key to IPFS');
      }

      const { cid: encryptedKeyCID } = await keyUploadRes.json();
      console.log('Encryption key uploaded to IPFS:', encryptedKeyCID);

      // Step 7: Store record on blockchain
      setProgress(80);
      const recordHashBytes = '0x' + fileHash;

      const result = await blockchainAPI.addRecord(
        walletAddress,
        dataCID,
        encryptedKeyCID,
        recordType,
        recordHashBytes,
        description.trim()
      );

      console.log('Record added to blockchain:', result);

      // Step 8: Log audit event
      setProgress(90);
      if (result.recordId) {
        await blockchainAPI.logAuditEvent(
          result.recordId,
          walletAddress,
          1, // RecordAdded
          recordHashBytes
        );
      }

      setProgress(100);

      // Success!
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setDescription('');
      setRecordType(0);
      setProgress(0);
      setError('');
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Upload Health Record</h2>
            <p className="text-sm text-gray-500 mt-1">Encrypted and stored on IPFS + Blockchain</p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* File Drop Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Upload
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragActive
                  ? 'border-indigo-500 bg-indigo-50'
                  : file
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.dcm,.doc,.docx"
              />

              {file ? (
                <div className="space-y-3">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium">
                      Drop your file here, or <span className="text-indigo-600">browse</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      PDF, JPG, PNG, DICOM (Max 50MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Record Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Record Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {RECORD_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setRecordType(type.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${recordType === type.value
                      ? `border-${type.color}-500 bg-${type.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <p className="text-sm font-medium text-gray-900">{type.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400">(max 100 characters)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
              rows={3}
              placeholder="Brief description (e.g., 'Annual checkup blood work')"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {description.length}/100 characters
            </p>
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">Uploading...</span>
                <span className="text-indigo-600 font-semibold">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {progress < 30 && '🔐 Encrypting file...'}
                {progress >= 30 && progress < 60 && '☁️ Uploading to IPFS...'}
                {progress >= 60 && progress < 90 && '⛓️ Storing on blockchain...'}
                {progress >= 90 && '✅ Finalizing...'}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-xs">
                  <li>• File encrypted with AES-256-GCM on your device</li>
                  <li>• Encrypted file uploaded to IPFS (decentralized storage)</li>
                  <li>• Encryption key stored securely on IPFS</li>
                  <li>• Only metadata stored on blockchain (no health data)</li>
                  <li>• You control who can access your records</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !description.trim() || uploading}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {uploading ? 'Uploading...' : 'Upload Record'}
          </button>
        </div>
      </div>
    </div>
  );
}