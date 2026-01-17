import { useState, useEffect, useCallback } from 'react';

const WORK_INTERVAL = 2 * 60 * 60 * 1000; // 2시간 - 광고 표시 전 작업 시간
const AD_DURATION = 15 * 60 * 1000; // 15분 - 광고 표시 시간

export const useWorkTimer = () => {
    const [showBreakReminder, setShowBreakReminder] = useState(false);
    const [workStartTime, setWorkStartTime] = useState<number>(Date.now());
    const [adEndTime, setAdEndTime] = useState<number | null>(null);

    // 로컬 스토리지에서 이전 작업 시간 복원
    useEffect(() => {
        const savedWorkStart = localStorage.getItem('workStartTime');
        const savedAdEnd = localStorage.getItem('adEndTime');

        if (savedWorkStart) {
            const startTime = parseInt(savedWorkStart);
            const now = Date.now();
            const elapsed = now - startTime;

            // 광고 종료 시간이 저장되어 있고 아직 광고 시간 내라면
            if (savedAdEnd) {
                const endTime = parseInt(savedAdEnd);
                if (now < endTime) {
                    // 아직 광고 표시 시간 중
                    setShowBreakReminder(true);
                    setAdEndTime(endTime);
                    setWorkStartTime(startTime);
                    
                    // 광고 종료 시간까지 대기
                    const remainingAdTime = endTime - now;
                    setTimeout(() => {
                        setShowBreakReminder(false);
                        setAdEndTime(null);
                        localStorage.removeItem('adEndTime');
                        // 작업 시작 시간을 광고 종료 시점으로 설정
                        const newStartTime = Date.now();
                        setWorkStartTime(newStartTime);
                        localStorage.setItem('workStartTime', newStartTime.toString());
                    }, remainingAdTime);
                    return;
                } else {
                    // 광고 시간이 지났지만 작업 시작 시간이 업데이트되지 않았음
                    localStorage.removeItem('adEndTime');
                }
            }

            // 마지막 작업 시간이 작업 간격 이상이면 바로 광고 표시
            if (elapsed >= WORK_INTERVAL) {
                setShowBreakReminder(true);
                const endTime = Date.now() + AD_DURATION;
                setAdEndTime(endTime);
                localStorage.setItem('adEndTime', endTime.toString());

                // 15분 후 자동으로 광고 숨김 및 타이머 리셋
                setTimeout(() => {
                    setShowBreakReminder(false);
                    setAdEndTime(null);
                    localStorage.removeItem('adEndTime');
                    const newStartTime = Date.now();
                    setWorkStartTime(newStartTime);
                    localStorage.setItem('workStartTime', newStartTime.toString());
                }, AD_DURATION);
            } else {
                setWorkStartTime(startTime);
            }
        }
    }, []);

    // 작업 시간 추적 및 광고 표시 로직
    useEffect(() => {
        const checkInterval = setInterval(() => {
            const now = Date.now();
            const elapsedTime = now - workStartTime;

            // 광고가 표시 중이면 종료 시간 확인
            if (showBreakReminder && adEndTime) {
                if (now >= adEndTime) {
                    // 광고 시간 종료
                    setShowBreakReminder(false);
                    setAdEndTime(null);
                    localStorage.removeItem('adEndTime');
                    // 작업 시작 시간을 현재 시점으로 리셋
                    const newStartTime = Date.now();
                    setWorkStartTime(newStartTime);
                    localStorage.setItem('workStartTime', newStartTime.toString());
                }
                return;
            }

            // 광고가 표시되지 않았고 작업 간격이 경과하면 광고 표시
            if (elapsedTime >= WORK_INTERVAL && !showBreakReminder) {
                setShowBreakReminder(true);
                const endTime = Date.now() + AD_DURATION;
                setAdEndTime(endTime);
                localStorage.setItem('adEndTime', endTime.toString());

                // 15분 후 자동으로 광고 숨김 및 타이머 리셋
                setTimeout(() => {
                    setShowBreakReminder(false);
                    setAdEndTime(null);
                    localStorage.removeItem('adEndTime');
                    const newStartTime = Date.now();
                    setWorkStartTime(newStartTime);
                    localStorage.setItem('workStartTime', newStartTime.toString());
                }, AD_DURATION);
            }
        }, 1000); // 1초마다 체크

        return () => clearInterval(checkInterval);
    }, [workStartTime, showBreakReminder, adEndTime]);

    // 작업 시간 저장
    useEffect(() => {
        localStorage.setItem('workStartTime', workStartTime.toString());
    }, [workStartTime]);

    // 남은 시간 계산 (분 단위)
    const getRemainingWorkTime = useCallback(() => {
        if (showBreakReminder && adEndTime) {
            // 광고 표시 중이면 남은 광고 시간 반환 (분 단위)
            const remaining = adEndTime - Date.now();
            return Math.ceil(remaining / (60 * 1000)); // 분 단위로 반올림
        }
        const elapsed = Date.now() - workStartTime;
        const remaining = WORK_INTERVAL - elapsed;
        return Math.max(0, Math.ceil(remaining / (60 * 1000))); // 분 단위로 반올림
    }, [workStartTime, showBreakReminder, adEndTime]);

    // 수동으로 광고 닫기 (15분이 지나지 않았어도 닫을 수 있음)
    const dismissReminder = useCallback(() => {
        setShowBreakReminder(false);
        setAdEndTime(null);
        localStorage.removeItem('adEndTime');
        // 작업 시작 시간을 현재 시점으로 리셋
        const newStartTime = Date.now();
        setWorkStartTime(newStartTime);
        localStorage.setItem('workStartTime', newStartTime.toString());
    }, []);

    return {
        showBreakReminder,
        dismissReminder,
        getRemainingWorkTime,
        workInterval: WORK_INTERVAL / 60000, // 분 단위로 반환 (120분 = 2시간)
        adDuration: AD_DURATION / 60000, // 분 단위로 반환 (15분)
    };
};
