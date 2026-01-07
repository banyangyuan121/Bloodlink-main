'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SessionProvider, useSession } from 'next-auth/react';
import { Permissions } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import Link from 'next/link';
import { Edit2, Save, Send, X } from 'lucide-react';
import { formatDateTimeThai } from '@/lib/utils';
import { toast } from 'sonner';
import { LabAlert } from '@/components/ui/LabAlert';
import { ConfirmModal } from '@/components/modals/ConfirmModal';

// Helper to check if value is outside range
const checkAbnormal = (val: string | undefined | null, range: string): boolean => {
    if (!val || val === '-' || !range) return false;

    // Clean value (remove commas, etc if any, though usually numeric string)
    // Handle cases like "< 0.5"? existing data seems to be numbers. Use parseFloat.
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return false;

    // Parse range "min-max"
    const parts = range.split('-');
    if (parts.length !== 2) return false;

    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);

    if (isNaN(min) || isNaN(max)) return false;

    return numVal < min || numVal > max;
};

interface LabResult {
    timestamp: string;
    hn: string;
    wbc?: string; wbc_note?: string;
    rbc?: string; rbc_note?: string;
    hb?: string; hb_note?: string;
    hct?: string; hct_note?: string;
    mcv?: string; mcv_note?: string;
    mch?: string; mch_note?: string;
    mchc?: string; mchc_note?: string;
    plt?: string; plt_note?: string;
    neutrophil?: string; neutrophil_note?: string;
    lymphocyte?: string; lymphocyte_note?: string;
    monocyte?: string; monocyte_note?: string;
    eosinophil?: string; eosinophil_note?: string;
    basophil?: string; basophil_note?: string;
    plateletSmear?: string; plateletSmear_note?: string;
    nrbc?: string; nrbc_note?: string;
    rbcMorphology?: string; rbcMorphology_note?: string;
}

interface PatientInfo {
    hn: string;
    name: string;
    surname: string;
    process?: string;
}

const LAB_TEST_ORDER = [
    'wbc', 'rbc', 'hb', 'hct', 'mcv', 'mch', 'mchc', 'plt',
    'neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil',
    'plateletSmear', 'nrbc', 'rbcMorphology'
];

interface LabRange {
    test_key: string;
    test_name: string;
    min_value: number | null;
    max_value: number | null;
    unit: string | null;
}

function BloodTestResultsContent() {
    const params = useParams();
    const hn = params.hn as string;

    const [patient, setPatient] = useState<PatientInfo | null>(null);
    const [labResults, setLabResults] = useState<LabResult | null>(null);
    const [editData, setEditData] = useState<LabResult | null>(null);
    const [ranges, setRanges] = useState<LabRange[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Permission check
    const { data: session } = useSession();
    const { effectiveRole } = useEffectiveRole();
    const canEditLab = Permissions.canEditLab(effectiveRole);

    useEffect(() => {
        if (!hn) return;

        const fetchData = async () => {
            try {
                // Fetch Patient & Results
                const resultRes = await fetch(`/api/lab-results/${hn}`);
                // Fetch Reference Ranges
                const rangesRes = await fetch('/api/settings/lab-ranges');

                if (!resultRes.ok || !rangesRes.ok) {
                    throw new Error('Failed to fetch data');
                }

                const resultData = await resultRes.json();
                const rangesData = await rangesRes.json();

                setPatient(resultData.patient);
                setLabResults(resultData.labResults);
                setEditData(resultData.labResults);
                setRanges(rangesData);

            } catch (err) {
                console.error('Fetch error:', err);
                setError('ไม่พบข้อมูลผลตรวจเลือด');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [hn]);

    const handlePrint = () => {
        window.print();
    };

    const handleStartEdit = () => {
        setEditData(labResults ? { ...labResults } : {
            hn: hn,
            timestamp: new Date().toISOString()
        });
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setEditData(labResults ? { ...labResults } : null);
        setIsEditing(false);
    };

    const handleSave = async (notify: boolean = false) => {
        if (!editData) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/lab-results/${hn}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                // Include notify flag in the body, LabService handles separation
                body: JSON.stringify({ ...editData, notify }),
            });

            if (response.ok) {
                setLabResults({ ...editData });
                setIsEditing(false);
                setIsConfirmModalOpen(false);
                if (notify) {
                    toast.success('บันทึกและส่งแจ้งเตือนเรียบร้อยแล้ว');
                } else {
                    toast.success('บันทึกร่างเรียบร้อยแล้ว');
                }
            } else {
                const data = await response.json();
                toast.error(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
            }
        } catch (err) {
            console.error('Save error:', err);
            toast.error('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApproveResult = async () => {
        if (!patient || !labResults) return;

        // Optimistic UI update (optional, but let's wait for API)
        const processPromise = async () => {
            const response = await fetch(`/api/patients/${hn}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'เสร็จสิ้น',
                    history: 'แพทย์ยืนยันผลการตรวจสอบ',
                    // We can pass user info if we had it from session here, 
                    // but the API usually handles it or we rely on session in API
                    changedByName: session?.user?.name,
                    changedByEmail: session?.user?.email,
                    changedByRole: effectiveRole
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update status');
            }

            // Update local patient state
            setPatient(prev => prev ? { ...prev, process: 'เสร็จสิ้น' } : null);
            return 'ยืนยันผลการตรวจสอบเรียบร้อย';
        };

        toast.promise(processPromise(), {
            loading: 'กำลังยืนยันผล...',
            success: (msg) => msg,
            error: (err) => err.message
        });
    };

    const handleInputChange = (key: string, value: string, isNote: boolean = false) => {
        if (!editData) return;
        const fieldKey = isNote ? `${key}_note` : key;
        setEditData({ ...editData, [fieldKey]: value });
    };

    const formatRange = (min: number | null, max: number | null) => {
        if (min !== null && max !== null) return `${min}-${max}`;
        if (min !== null) return `> ${min}`;
        if (max !== null) return `< ${max}`;
        return '';
    };

    const renderTestRow = (test: LabRange, separatorTop?: boolean, separatorBottom?: boolean) => {
        const value = labResults?.[test.test_key as keyof LabResult] || '-';
        const note = labResults?.[`${test.test_key}_note` as keyof LabResult] || '-';
        const editValue = editData?.[test.test_key as keyof LabResult] || '';
        const editNote = editData?.[`${test.test_key}_note` as keyof LabResult] || '';

        // Dynamic Range String
        const rangeStr = formatRange(test.min_value, test.max_value);

        let borderClasses = 'border-b border-gray-200 dark:border-gray-700';
        if (separatorTop) {
            borderClasses += ' border-t-2 border-t-gray-400 dark:border-t-gray-500';
        }
        if (separatorBottom) {
            borderClasses += ' border-b-2 border-b-gray-400 dark:border-b-gray-500';
        }

        return (
            <tr key={test.test_key} className={borderClasses}>
                <td className="py-2 px-4 text-[13px] text-gray-700 dark:text-gray-200">{test.test_name}</td>
                <td className="py-2 px-4 text-[13px] text-gray-600 dark:text-gray-300">
                    {isEditing ? (
                        <input
                            type="text"
                            value={String(editValue)}
                            onChange={(e) => handleInputChange(test.test_key, e.target.value)}
                            className="w-full px-2 py-1 text-[13px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    ) : (
                        <LabAlert isAbnormal={checkAbnormal(String(value), rangeStr)} val={String(value)} />
                    )}
                </td>
                <td className="py-2 px-4 text-[13px] text-gray-500 dark:text-gray-400">{test.unit || ''}</td>
                <td className="py-2 px-4 text-[13px] text-gray-500 dark:text-gray-400">{rangeStr}</td>
                <td className="py-2 px-4 text-[13px] text-gray-500 dark:text-gray-400">
                    {isEditing ? (
                        <input
                            type="text"
                            value={String(editNote)}
                            onChange={(e) => handleInputChange(test.test_key, e.target.value, true)}
                            className="w-full px-2 py-1 text-[13px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="หมายเหตุ..."
                        />
                    ) : (
                        note
                    )}
                </td>
            </tr>
        );
    };

    // Filter and Sort Ranges
    const cbcTests = ranges.filter(r =>
        ['wbc', 'rbc', 'hb', 'hct', 'mcv', 'mch', 'mchc', 'plt'].includes(r.test_key)
    ).sort((a, b) => LAB_TEST_ORDER.indexOf(a.test_key) - LAB_TEST_ORDER.indexOf(b.test_key));

    const diffTests = ranges.filter(r =>
        ['neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil', 'plateletSmear', 'nrbc', 'rbcMorphology'].includes(r.test_key)
    ).sort((a, b) => LAB_TEST_ORDER.indexOf(a.test_key) - LAB_TEST_ORDER.indexOf(b.test_key));

    if (isLoading) {
        return (
            <div className="flex bg-[#F3F4F6] dark:bg-[#0f1115] min-h-screen font-[family-name:var(--font-kanit)]">
                <Sidebar />
                <div className="ml-0 md:ml-[195px] flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366F1]"></div>
                </div>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="flex bg-[#F3F4F6] dark:bg-[#0f1115] min-h-screen font-[family-name:var(--font-kanit)]">
                <Sidebar />
                <div className="ml-0 md:ml-[195px] flex-1 flex flex-col h-screen overflow-hidden">
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F3F4F6] dark:bg-[#0f1115] p-3 pt-0">
                        <div className="max-w-[960px] w-full mx-auto flex flex-col h-full">
                            <Header />
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-red-500 mb-4">{error || 'ไม่พบข้อมูล'}</p>
                                    <Link href="/results" className="text-[#6366F1] hover:underline">
                                        กลับไปหน้าผลตรวจ
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body { background: white !important; }
                    .sidebar, .header-components, .print-hide { display: none !important; }
                    .print-container { margin: 0 !important; padding: 20px !important; }
                    .print-card { box-shadow: none !important; border: 1px solid #ddd !important; }
                }
            `}</style>

            <div className="flex bg-[#F3F4F6] dark:bg-[#0f1115] min-h-screen font-[family-name:var(--font-kanit)] transition-colors">
                <div className="print-hide">
                    <Sidebar />
                </div>
                <div className="ml-0 md:ml-[195px] print:ml-0 flex-1 flex flex-col min-h-screen print-container w-full overflow-x-hidden">
                    <main className="flex-1 bg-[#F3F4F6] dark:bg-[#0f1115] p-3 sm:p-6 lg:p-8 pt-0 transition-colors print:bg-white pb-8">
                        <div className="w-full sm:max-w-[960px] mx-auto print:max-w-none">
                            <div className="print-hide">
                                <Header />
                            </div>

                            {/* Blood Test Card */}
                            <div className="bg-white dark:bg-[#1e1e2e] rounded-3xl shadow-sm overflow-hidden print-card border border-gray-100 dark:border-gray-700">
                                <div className="p-3 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {/* Profile Icon */}
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#E8EEF5] dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-7 h-7 sm:w-10 sm:h-10 text-[#9CA3AF] dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h1 className="text-lg sm:text-xl font-semibold text-[#1F2937] dark:text-white mb-2 break-all sm:break-normal">
                                                {patient.name} {patient.surname}
                                            </h1>
                                            {/* HN Digits in Boxes */}
                                            <div className="flex flex-wrap gap-1">
                                                {String(patient.hn).split('').map((digit, i) => (
                                                    <span
                                                        key={i}
                                                        className="w-6 h-6 bg-[#F3F4F6] dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300"
                                                    >
                                                        {digit}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="print-hide flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                        {/* Doctor Approve Button */}
                                        {canEditLab && Permissions.isDoctor(effectiveRole) && patient?.process === 'กำลังตรวจ' && !isEditing && (
                                            <button
                                                onClick={handleApproveResult}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors text-sm font-medium"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                ยืนยันผลการตรวจสอบ
                                            </button>
                                        )}

                                        {canEditLab && !isEditing && (
                                            <button
                                                onClick={handleStartEdit}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] transition-colors text-sm font-medium"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                แก้ไข
                                            </button>
                                        )}
                                        {isEditing && (
                                            <>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                                                >
                                                    <X className="w-4 h-4" />
                                                    ยกเลิก
                                                </button>
                                                <button
                                                    onClick={() => handleSave(false)}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    {isSaving ? '...' : 'บันทึกร่าง'}
                                                </button>
                                                <button
                                                    onClick={() => setIsConfirmModalOpen(true)}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-2 px-4 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors text-sm font-medium disabled:opacity-50 shadow-lg shadow-green-500/20"
                                                >
                                                    <Send className="w-4 h-4" />
                                                    {isSaving ? 'กำลังส่ง...' : 'ยืนยันและส่งผล'}
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={handlePrint}
                                            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] transition-colors text-sm font-medium"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125H8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                                            </svg>
                                            Print
                                        </button>
                                    </div>
                                </div>

                                {/* Results Table */}
                                <div className="border-t border-gray-100 dark:border-gray-700">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full min-w-[700px]">
                                            <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <th className="text-left py-3 px-4 text-[13px] font-semibold text-gray-700 dark:text-gray-200 w-[200px]">Test / Description</th>
                                                    <th className="text-left py-3 px-4 text-[13px] font-semibold text-gray-700 dark:text-gray-200 w-[150px]">Result</th>
                                                    <th className="text-left py-3 px-4 text-[13px] font-semibold text-gray-700 dark:text-gray-200 w-[100px]">Unit</th>
                                                    <th className="text-left py-3 px-4 text-[13px] font-semibold text-gray-700 dark:text-gray-200 w-[120px]">Normal Range</th>
                                                    <th className="text-left py-3 px-4 text-[13px] font-semibold text-gray-700 dark:text-gray-200">หมายเหตุ</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {/* CBC Header */}
                                                <tr>
                                                    <td colSpan={5} className="py-2 px-4 text-sm font-bold text-gray-800 dark:text-gray-100 bg-gray-50/30 dark:bg-gray-800/30">
                                                        CBC
                                                    </td>
                                                </tr>
                                                {/* CBC Tests */}
                                                {cbcTests.map((test) => renderTestRow(test))}

                                                {/* Differential Header (Optional, but adds spacing) */}
                                                {/* The screenshot shows just a clean list, but maybe the user wants the section headers back because they said "table like this is gone" */}
                                                {/* I will add a subtle spacer or check if Differential header is needed. */}
                                                {/* Wait, the screenshot shows 'CBC' bolded at the top of the test list. */}

                                                {/* Differential Tests */}
                                                {diffTests.map((test) =>
                                                    renderTestRow(
                                                        test,
                                                        test.test_key === 'neutrophil', // separatorTop for Neutrophil
                                                        test.test_key === 'lymphocyte'  // separatorBottom for Lymphocyte
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Timestamp Footer */}
                                {labResults?.timestamp && (
                                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-right text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                                        วันที่ตรวจ: {formatDateTimeThai(labResults.timestamp)}
                                    </div>
                                )}

                                {/* No Results Message */}
                                {!labResults && (
                                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        ยังไม่มีผลตรวจเลือด
                                    </div>
                                )}
                            </div>

                            {/* Back Link */}
                            <div className="mt-4 print-hide">
                                <Link
                                    href="/results"
                                    className="inline-flex items-center gap-2 text-[#6366F1] hover:underline text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    กลับไปหน้ารายการผลตรวจ
                                </Link>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={() => handleSave(true)}
                title="ยืนยันการส่งผลตรวจ"
                description="คุณต้องการยืนยันและส่งผลการตรวจเลือดหรือไม่? เมื่อยืนยันแล้วระบบจะส่งการแจ้งเตือนไปยังแพทย์ผู้รับผิดชอบทันที"
                confirmText="ยืนยันและส่ง"
                cancelText="ตรวจสอบอีกครั้ง"
                variant="primary"
                isLoading={isSaving}
            />
        </>
    );
}

// Wrap with SessionProvider
export default function BloodTestResultsPage() {
    return (
        <SessionProvider>
            <BloodTestResultsContent />
            <div id="modal-root" />
        </SessionProvider>
    );
}
