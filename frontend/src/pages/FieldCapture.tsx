import React, { useState, useEffect } from 'react';
import { Camera, Upload, CheckCircle2, XCircle, ShieldAlert, FileText, RefreshCw, Eye } from 'lucide-react';
import { apiClient } from '../api/client';

export const FieldCapture: React.FC = () => {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [resultData, setResultData] = useState<any | null>(null);

  // Form states
  const [operatorId, setOperatorId] = useState<string>('OFFICER_104');
  const [location, setLocation] = useState<string>('Central Plaza Junction');

  const fetchEvidence = async () => {
    try {
      const res = await apiClient.get('/evidence');
      setEvidenceList(res.data);
    } catch (err) {
      console.error('Error fetching evidence records:', err);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedPhoto) return;
    setAnalyzing(true);
    try {
      const res = await apiClient.post('/field-capture/photo', {
        operator_id: operatorId,
        location: location,
        photo_base64: selectedPhoto
      });
      setResultData(res.data);
      fetchEvidence();
    } catch (err) {
      console.error('Error analyzing photo:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReviewStatus = async (id: number, status: string) => {
    try {
      await apiClient.put(`/evidence/${id}/review`, null, {
        params: { review_status: status }
      });
      fetchEvidence();
    } catch (err) {
      console.error('Error updating review status:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase">FIELD CAPTURE & PHOTO ANPR ANALYSIS</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Authorized Field Operator Photo Ingestion & Evidence Review Panel</p>
        </div>
      </div>

      {/* Main Grid: Photo Upload & AI Analysis Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Photo Upload Box */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
          <h2 className="text-xs font-mono font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#245B84]" /> FIELD PHOTO CAPTURE & UPLOAD
          </h2>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase mb-1">Operator ID</label>
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 uppercase mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-2 border-dashed border-[#DCE4EA] rounded-lg p-6 text-center hover:border-[#245B84] transition-colors relative">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {selectedPhoto ? (
              <img src={selectedPhoto} alt="Field preview" className="max-h-48 mx-auto rounded border" />
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-mono">Click or drag field vehicle photo here</p>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyzePhoto}
            disabled={!selectedPhoto || analyzing}
            className={`w-full py-2.5 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 ${
              selectedPhoto && !analyzing ? 'bg-[#245B84] hover:bg-[#1E4A6F] text-white shadow-xs' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {analyzing ? 'RUNNING CLAHE ANPR ANALYSIS...' : 'ANALYZE FIELD PHOTO'}
          </button>
        </div>

        {/* Right Column: AI Analysis Result & Record */}
        <div className="lg:col-span-7 bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
            <h2 className="text-xs font-mono font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#245B84]" /> AI ANALYSIS RESULT RECORD
            </h2>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono font-bold text-[10px]">
              AI DETECTION — NOT VERIFIED
            </span>
          </div>

          {resultData ? (
            <div className="p-4 bg-[#F2F7FC] rounded border border-[#DCE4EA] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-[#245B84]">RECORD ID: {resultData.record_id}</span>
                <span className="text-slate-500">{resultData.captured_at}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 text-[10px]">OBSERVED PLATE</span>
                  <p className="text-base font-bold text-[#245B84]">{resultData.plate_number}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">OCR CONFIDENCE</span>
                  <p className="text-base font-bold text-[#2E7D5B]">{Math.round(resultData.ocr_confidence * 100)}%</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">VEHICLE TYPE</span>
                  <p className="font-bold uppercase">{resultData.vehicle_type}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">LOCATION</span>
                  <p className="font-bold">{resultData.location}</p>
                </div>
              </div>
              <div className="p-2 bg-amber-100/60 border border-amber-200 text-amber-800 text-[10px] rounded">
                DISCLAIMER: {resultData.disclaimer}. Operator verification required before legal confirmation.
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 font-mono text-xs">
              Upload a field photo and click "ANALYZE FIELD PHOTO" to process ANPR plate text and vehicle classification.
            </div>
          )}
        </div>
      </div>

      {/* Field Evidence History & Review Table */}
      <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
        <h2 className="text-xs font-mono font-extrabold text-slate-700 uppercase flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-[#B7791F]" /> FIELD EVIDENCE REVIEW LOG
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#DCE4EA] bg-[#F6F8FA] text-slate-500 uppercase text-[10px]">
                <th className="p-2.5">Record ID</th>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Operator</th>
                <th className="p-2.5">Location</th>
                <th className="p-2.5">Observed Plate</th>
                <th className="p-2.5">OCR Conf</th>
                <th className="p-2.5">Review Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EA]">
              {evidenceList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400 text-xs">No evidence records logged yet.</td>
                </tr>
              ) : (
                evidenceList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-[#245B84]">{item.record_id}</td>
                    <td className="p-2.5 text-slate-500">{new Date(item.timestamp).toLocaleString()}</td>
                    <td className="p-2.5">{item.operator_id}</td>
                    <td className="p-2.5">{item.location}</td>
                    <td className="p-2.5 font-bold">{item.plate_number}</td>
                    <td className="p-2.5 text-[#2E7D5B] font-bold">{Math.round(item.ocr_confidence * 100)}%</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                        item.review_status === 'VERIFIED' ? 'bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]' :
                        item.review_status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {item.review_status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right space-x-2">
                      {item.review_status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleReviewStatus(item.id, 'VERIFIED')}
                            className="px-2 py-1 bg-[#2E7D5B] text-white hover:bg-[#236347] text-[10px] font-bold rounded"
                          >
                            VERIFY
                          </button>
                          <button
                            onClick={() => handleReviewStatus(item.id, 'REJECTED')}
                            className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 text-[10px] font-bold rounded"
                          >
                            REJECT
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
