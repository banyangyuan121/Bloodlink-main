'use client';

import { authenticate, register } from '@/lib/actions';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomCheckbox } from '@/components/ui/CustomCheckbox';

type FormMode = 'login' | 'register';

export default function LoginPage() {
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [mode, setMode] = useState<FormMode>('login');

    // Login State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Register State
    const [regRole, setRegRole] = useState('แพทย์');
    const [regName, setRegName] = useState('');
    const [regSurname, setRegSurname] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [regHospitalType, setRegHospitalType] = useState('แม่ข่าย');
    const [regHospitalName, setRegHospitalName] = useState('');
    const [regPrivacy, setRegPrivacy] = useState(false);
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    const switchMode = (newMode: FormMode) => {
        setMode(newMode);
        setErrorMessage('');
        setRegError('');
        setRegSuccess('');
        setFieldErrors({});
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        setFieldErrors({});

        try {
            const result = await authenticate(email, password);
            if (result?.error) {
                setErrorMessage(result.error);
                if (result.fieldErrors) {
                    setFieldErrors(result.fieldErrors);
                }
                setIsLoading(false);
            } else {
                window.location.href = '/dashboard';
            }
        } catch {
            setErrorMessage('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegError('');
        setRegSuccess('');
        setFieldErrors({});
        setIsLoading(true);

        if (regPassword !== regConfirmPassword) {
            setRegError('รหัสผ่านไม่ตรงกัน');
            setIsLoading(false);
            return;
        }
        if (!regPrivacy) {
            setRegError('กรุณายอมรับนโยบายความเป็นส่วนตัว');
            setIsLoading(false);
            return;
        }

        try {
            const result = await register({
                role: regRole,
                name: regName,
                surname: regSurname,
                email: regEmail,
                password: regPassword,
                hospitalType: regHospitalType,
                hospitalName: regHospitalName
            });

            if (result.error) {
                setRegError(result.error);
                if (result.fieldErrors) {
                    setFieldErrors(result.fieldErrors);
                }
                setIsLoading(false);
                return;
            }

            setRegSuccess('ลงทะเบียนสำเร็จ! กรุณารอการตรวจสอบและอนุมัติจากแอดมิน');

            setTimeout(() => {
                switchMode('login');
                setEmail(regEmail);
                setIsLoading(false);
            }, 3000);
        } catch (error) {
            setRegError('เกิดข้อผิดพลาดขณะลงทะเบียน');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0f1115] flex items-center justify-center p-5 md:p-10 font-[family-name:var(--font-kanit)] transition-colors">
            <div className={`bg-white dark:bg-[#1F2937] rounded-3xl shadow-2xl dark:shadow-none w-full max-w-[900px] overflow-hidden flex flex-col md:flex-row ${mode === 'register' ? 'md:min-h-[700px]' : 'h-[640px]'} transition-all`}>

                {/* Left Panel: Illustration */}
                <div className="hidden md:flex flex-col items-center justify-center w-1/2 bg-[#D1ECF1] dark:bg-[#1e293b] relative p-8 shadow-lg rounded-lg transition-colors">
                    <d
