'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { blockchainAPI, getRecordTypeName } from '@/lib/blockchain-api';
import type { HealthRecord, AccessRequest } from '@/types/records';
import FileUploadModal from '@/components/FileUploadModal';
import RecordViewer from '@/components/RecordViewer';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [showRecordViewer, setShowRecordViewer] = useState(false);
  const [grantingAccess, setGrantingAccess] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = storage.getToken();
    const address = storage.getAddress();
    const role = storage.getRole();

    if (!token || !address) {
      router.push('/login');
      return;
    }

    setWalletAddress(address);
    setUserRole(role);

    if (role === 'patient') {
      loadPatientData(address);
    } else {
      loadDoctorData(address);
    }
  }, []);

  const loadPatientData = async (address: string) => {
    try {
      setLoading(true);

      // Load records
      const patientRecords = await blockchainAPI.getPatientRecords(address);
      setRecords(patientRecords);

      // Load pending access requests
      const requests = await blockchainAPI.getPendingRequests(address);

      // Fetch record details for each request
      const requestsWithDetails = await Promise.all(
        requests.map(async (req) => {
          try {
            const recordDetails = await blockchainAPI.getRecord(req.recordId);
            return {
              ...req,
              recordDescription: recordDetails.shortDescription,
              recordType: recordDetails.recordType,
            };
          } catch (err) {
            return req;
          }
        })
      );

      setPendingRequests(requestsWithDetails);
    } catch (error: any) {
      console.error('Error loading patient data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorData = async (address: string) => {
    try {
      setLoading(true);

      // Load accessible records
      const accessibleRecords = await blockchainAPI.getDoctorAccessibleRecords(address);

      // Fetch full record details
      const recordsWithDetails = await Promise.all(
        accessibleRecords.map(async (record) => {
          try {
            return await blockchainAPI.getRecord(record.recordId);
          } catch (err) {
            return null;
          }
        })
      );

      setRecords(recordsWithDetails.filter(r => r !== null) as HealthRecord[]);
    } catch (error: any) {
      console.error('Error loading doctor data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async (accessId: number, recordId: number) => {
    try {
      setGrantingAccess(accessId);
      setError('');
      setSuccess('');

      // Get the access request details
      const accessGrant = await blockchainAPI.getAccessGrant(accessId);

      // Get the record to find encryption key
      const record = await blockchainAPI.getRecord(recordId);

      // For now, we'll reuse the patient's own encryption key CID
      // In production, you'd re-encrypt the key for the doctor
      const encryptedKeyCID = record.encryptedKeyCID;

      // Grant access for 30 days
      await blockchainAPI.grantAccess(accessId, encryptedKeyCID, 30);

      setSuccess(`Access granted to ${accessGrant.doctor.slice(0, 10)}... for 30 days`);

      // Reload data
      if (userRole === 'patient') {
        await loadPatientData(walletAddress);
      }
    } catch (error: any) {
      console.error('Error granting access:', error);
      setError(error.message || 'Failed to grant access');
    } finally {
      setGrantingAccess(null);
    }
  };

  const handleLogout = () => {
    storage.removeToken();
    router.push('/login');
  };

  const handleViewRecord = (record: HealthRecord) => {
    setSelectedRecord(record);
    setShowRecordViewer(true);
  };

  const getRecordTypeColor = (type: number): string => {
    const colors = ['blue', 'green', 'purple', 'pink', 'red', 'gray'];
    return colors[type] || 'gray';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Patient Dashboard View
  if (userRole === 'patient') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Navigation */}
        <nav className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    My Health Records
                  </h1>
                  <p className="text-xs text-gray-500">Patient Dashboard</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-gray-500">Wallet</p>
                  <p className="text-sm font-mono font-semibold text-gray-700">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-pink-600 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Alerts */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg animate-shake">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{success}</span>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Records</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{records.length}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{pendingRequests.length}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Storage</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">IPFS</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Access Requests */}
          {pendingRequests.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Access Requests</h2>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  {pendingRequests.length} Pending
                </span>
              </div>

              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div key={request.accessId} className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg p-6 border border-white/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-lg">⚕️</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Doctor requesting access</p>
                            <p className="text-xs font-mono text-gray-500">
                              {request.doctor.slice(0, 10)}...{request.doctor.slice(-8)}
                            </p>
                          </div>
                        </div>

                        <div className="ml-13 space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-gray-500">Record:</span>
                            <span className="text-sm text-gray-900">{(request as any).recordDescription || 'Health Record'}</span>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-500 mb-1">Reason:</p>
                            <p className="text-sm text-gray-700">{request.requestReason}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleGrantAccess(request.accessId, request.recordId)}
                        disabled={grantingAccess === request.accessId}
                        className="ml-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {grantingAccess === request.accessId ? 'Granting...' : 'Grant Access'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Upload New Record</span>
            </button>
          </div>

          {/* Records Grid */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">My Records</h2>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-gray-600 mt-4">Loading records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-12 text-center border border-white/20">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No records yet</h3>
                <p className="text-gray-600 mb-6">Upload your first health record to get started</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Upload Record
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {records.map((record) => (
                  <div
                    key={record.recordId}
                    className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-shadow cursor-pointer"
                    onClick={() => handleViewRecord(record)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 bg-${getRecordTypeColor(record.recordType)}-100 rounded-xl flex items-center justify-center`}>
                        <span className="text-2xl">
                          {record.recordType === 0 && '📄'}
                          {record.recordType === 1 && '🧪'}
                          {record.recordType === 2 && '🩻'}
                          {record.recordType === 3 && '💊'}
                          {record.recordType === 4 && '🏥'}
                          {record.recordType === 5 && '📋'}
                        </span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-${getRecordTypeColor(record.recordType)}-100 text-${getRecordTypeColor(record.recordType)}-800`}>
                        {getRecordTypeName(record.recordType)}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {record.shortDescription}
                    </h3>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(record.createdAt)}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs font-mono">{record.addedBy.slice(0, 10)}...</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Record #{record.recordId}</span>
                      <span className="text-indigo-600 text-sm font-medium hover:text-indigo-700">
                        View Details →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Modals */}
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            setSuccess('Record uploaded successfully!');
            loadPatientData(walletAddress);
          }}
        />

        <RecordViewer
          record={selectedRecord}
          isOpen={showRecordViewer}
          onClose={() => {
            setShowRecordViewer(false);
            setSelectedRecord(null);
          }}
        />
      </div>
    );
  }

  // Doctor Dashboard View
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">⚕️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Patient Records
                </h1>
                <p className="text-xs text-gray-500">Doctor Dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-500">Wallet</p>
                <p className="text-sm font-mono font-semibold text-gray-700">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-pink-600 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Accessible Records</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{records.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-3xl font-bold text-green-600 mt-2">Verified</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Records */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Patient Records</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-gray-600 mt-4">Loading records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-12 text-center border border-white/20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No accessible records</h3>
              <p className="text-gray-600">Request access from patients to view their health records</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {records.map((record) => (
                <div
                  key={record.recordId}
                  className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => handleViewRecord(record)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 bg-${getRecordTypeColor(record.recordType)}-100 rounded-xl flex items-center justify-center`}>
                      <span className="text-2xl">
                        {record.recordType === 0 && '📄'}
                        {record.recordType === 1 && '🧪'}
                        {record.recordType === 2 && '🩻'}
                        {record.recordType === 3 && '💊'}
                        {record.recordType === 4 && '🏥'}
                        {record.recordType === 5 && '📋'}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-${getRecordTypeColor(record.recordType)}-100 text-${getRecordTypeColor(record.recordType)}-800`}>
                      {getRecordTypeName(record.recordType)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {record.shortDescription}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-xs">Patient: {record.owner.slice(0, 10)}...</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(record.createdAt)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Record #{record.recordId}</span>
                    <span className="text-purple-600 text-sm font-medium hover:text-purple-700">
                      View Details →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div >
      </main >

      {/* Modal */}
      < RecordViewer
        record={selectedRecord}
        isOpen={showRecordViewer}
        onClose={() => {
          setShowRecordViewer(false);
          setSelectedRecord(null);
        }
        }
      />
    </div >
  );
}
