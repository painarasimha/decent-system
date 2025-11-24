"use client";
import React, { useEffect, useState } from "react";
import { Card } from "../_components/ui";
import { SHARED_ACCESS, SharedAccessEntry, formatDate } from "./access-data";
import { blockchainAPI } from '../../../../lib/blockchain-api';

function statusColor(status: SharedAccessEntry["status"]) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "revoked":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "expired":
      return "bg-gray-200 text-gray-600 border-gray-300";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export default function PatientAccessPage() {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [grantModal, setGrantModal] = useState<any | null>(null);
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);
  const patientAddress = typeof window !== "undefined" ? (window.localStorage.getItem("address") ?? "") : "";

  useEffect(() => {
    async function fetchRequests() {
      if (!patientAddress) return;
      const reqs = await blockchainAPI.getPendingRequests(patientAddress);
      setPendingRequests(reqs);
    }
    fetchRequests();
  }, [patientAddress]);

  async function handleGrantAccess(request: any) {
    setLoading(true);
    // TODO: Encrypt record key for doctor, upload to IPFS, get CID
    // For now, use a placeholder CID
    const encryptedKeyCID = "QmPlaceholderEncryptedKeyCID";
    await blockchainAPI.grantAccess(request.accessId, encryptedKeyCID, duration);
    setLoading(false);
    setGrantModal(null);
    // Refresh requests
    const reqs = await blockchainAPI.getPendingRequests(patientAddress);
    setPendingRequests(reqs);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-wide text-gray-800">Pending Access Requests</h1>
      </div>

      <Card className="p-5">
        {pendingRequests.length === 0 ? (
          <div className="text-gray-500 text-sm">No pending access requests.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#eef5ff] text-gray-600">
                <th className="py-3 pl-5 pr-3 text-left font-medium">Doctor</th>
                <th className="px-3 py-3 text-left font-medium">Record ID</th>
                <th className="px-3 py-3 text-left font-medium">Reason</th>
                <th className="px-3 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((req) => (
                <tr key={req.accessId} className="border-t border-gray-100 hover:bg-[#f5f9ff] transition">
                  <td className="py-3 pl-5 pr-3">{req.doctor}</td>
                  <td className="px-3 py-3">{req.recordId}</td>
                  <td className="px-3 py-3">{req.requestReason}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="rounded-full bg-[#1678ff] px-4 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#0f63d6]"
                      onClick={() => setGrantModal(req)}
                    >
                      Grant Access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[6px]">
          <div className="w-[340px] rounded-[32px] border border-white/70 bg-white px-6 py-7 text-center shadow-[0px_42px_120px_-60px_rgba(15,23,42,0.55)]">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Grant Access to Doctor</h3>
            <div className="mb-3 text-sm text-gray-700">Doctor: {grantModal.doctor}</div>
            <div className="mb-3 text-sm text-gray-700">Record ID: {grantModal.recordId}</div>
            <div className="mb-3 text-sm text-gray-700">Reason: {grantModal.requestReason}</div>
            <label className="block mb-2 text-sm font-medium text-gray-700">Duration (days):</label>
            <input
              type="number"
              min={1}
              max={365}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f9bff] mb-4"
            />
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleGrantAccess(grantModal)}
                className="rounded-full bg-[#1678ff] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f63d6]"
                disabled={loading}
              >
                {loading ? "Granting..." : "Grant Access"}
              </button>
              <button
                type="button"
                onClick={() => setGrantModal(null)}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Card className="p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700">How sharing works</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">
          <li>Only authorized providers can view data within the scope you grant.</li>
          <li>You can revoke an active share instantly; expired shares require renewal.</li>
          <li>"Reports Only" restricts access to uploaded PDF / imaging reports.</li>
          <li>"Medications Only" includes current and historical prescriptions.</li>
        </ul>
      </Card>
    </div>
  );
}
