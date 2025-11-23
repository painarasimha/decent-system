'use client';

import { useState } from 'react';
import { downloadFromIPFS, downloadJSONFromIPFS } from '@/lib/ipfs-client';
import { decryptData, importKey } from '@/lib/encryption';
import { getRecordTypeName } from '@/lib/blockchain-api';
import type { HealthRecord } from '@/types/records';

interface RecordViewerProps {
  record: HealthRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function RecordViewer({ record, isOpen, onClose }: RecordViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !record) return null;

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError('');

      // Step 1: Download encryption key from IPFS
      const keyData = await downloadJSONFromIPFS(record.encryptedKeyCID);
      const symmetricKey = await importKey(keyData.key);

      // Step 2: Download encrypted file from IPFS
      const encryptedBlob = await downloadFromIPFS(record.dataCID);
      const encryptedText = await encryptedBlob.text();
      const encryptedMetadata = JSON.parse(encryptedText);

      // Step 3: Decrypt file
      const decryptedBuffer = await decryptData(
        {
          ciphertext: encryptedMetadata.ciphertext,
          iv: encryptedMetadata.iv,
          salt: encryptedMetadata.salt,
        },
        symmetricKey
      );

      // Step 4: Create blob and download
      const blob = new Blob([decryptedBuffer], { type: encryptedMetadata.originalFileType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = encryptedMetadata.originalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Success notification
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download and decrypt file');
    } finally {
      setDownloading(false);
    }
  };

  const getRecordTypeColor = (type: number): string => {
    const colors = ['blue', 'green', 'purple', 'pink', 'red', 'gray'];
    return colors[type] || 'gray';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="text-white">
            <h2 className="text-xl font-bold">Health Record Details</h2>
            <p className="text-indigo-100 text-sm mt-1">Record #{record.recordId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
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

          {/* Record Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Record Type</p>
              <div className="flex items-center space-x-2">
                <span className={`inline-block w-3 h-3 rounded-full bg-${getRecordTypeColor(record.recordType)}-500`}></span>
                <p className="text-sm font-semibold text-gray-900">{getRecordTypeName(record.recordType)}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Date Created</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(record.createdAt)}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 col-span-2">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
              <p className="text-sm text-gray-900">{record.shortDescription}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Added By</p>
              <p className="text-xs font-mono text-gray-700">
                {record.addedBy.slice(0, 6)}...{record.addedBy.slice(-4)}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Status</p>
              <div className="flex items-center space-x-2">
                <span className={`inline-block w-2 h-2 rounded-full ${record.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <p className="text-sm font-semibold text-gray-900">{record.isActive ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          </div>

          {/* IPFS CIDs */}
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-medium text-blue-900 uppercase mb-2">Data CID (IPFS)</p>
              <p className="text-xs font-mono text-blue-700 break-all">{record.dataCID}</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-xs font-medium text-purple-900 uppercase mb-2">Encryption Key CID (IPFS)</p>
              <p className="text-xs font-mono text-purple-700 break-all">{record.encryptedKeyCID}</p>
            </div>
          </div>

          {/* Security Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">🔐 Security Details:</p>
                <ul className="space-y-1 text-xs">
                  <li>• File encrypted with AES-256-GCM</li>
                  <li>• Stored on IPFS (decentralized)</li>
                  <li>• Blockchain verification hash: {record.recordHash.slice(0, 10)}...</li>
                  <li>• Only you can decrypt this file</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 rounded-b-2xl border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Decrypting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download & Decrypt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div >
  );
}