import React, { useEffect, useRef } from 'react';

interface WaveformBarProps {
    isActive: boolean;
    color?: string;
    barCount?: number;
    height?: number;
    className?: string;
}

export const WaveformBar: React.FC<WaveformBarProps> = ({
    isActive,
    color = '#3b82f6',
    barCount = 12,
    height = 40,
    className = '',
}) => {
    const [wave, setWave] = React.useState<number[]>(Array(barCount).fill(0));
    const raf = useRef<number>();

    useEffect(() => {
        let running = true;
        function animate() {
            if (!running) return;
            const now = Date.now() / 300;
            setWave(
                Array.from({ length: barCount }, (_, i) => {
                    if (!isActive) return 8;
                    // Sine wave for smooth animation
                    return 10 + Math.abs(Math.sin(now + i * 0.5)) * (height - 10);
                })
            );
            raf.current = requestAnimationFrame(animate);
        }
        animate();
        return () => {
            running = false;
            if (raf.current) cancelAnimationFrame(raf.current);
        };
    }, [isActive, barCount, height]);

    return (
        <div className={`flex items-end gap-1 ${className}`} style={{ height: height + 8 }}>
            {wave.map((h, i) => (
                <div
                    key={i}
                    className={`w-2 rounded-full transition-all duration-150 ${isActive ? 'shadow-[0_0_16px_2px_rgba(59,130,246,0.5)]' : ''}`}
                    style={{
                        height: `${h}px`,
                        background: isActive
                            ? `linear-gradient(180deg, ${color} 60%, #60a5fa 100%)`
                            : '#334155',
                        opacity: isActive ? 0.95 : 0.3,
                        transitionProperty: 'height, opacity, background',
                    }}
                />
            ))}
        </div>
    );
};