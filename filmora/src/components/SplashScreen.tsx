"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { siteConfig } from "@/lib/config";

/**
 * Netflix / Prime style intro:
 *  1. Dark screen + light sweep, logo icon lands in the centre
 *  2. Icon shifts up to make room
 *  3. A big "M" drops in
 *  4. "ovie Box" unrolls out of the M -> "MOVIE BOX"
 *  5. "by Beta Bot Hub" reveals, everything zooms out
 */
const DURATION = 5200;

const T_ICON = 200;     // icon slam
const T_SHIFT = 1500;   // icon moves up
const T_M = 2100;       // M drops
const T_REST = 2650;    // rest of the name unrolls
const T_BY = 3900;      // by-line

export default function SplashScreen() {
    const [visible, setVisible] = useState(false);
    const [stage, setStage] = useState(0); // 0 icon, 1 shifted, 2 M, 3 full name, 4 by-line
    const [progress, setProgress] = useState(0);

    const fullName = (siteConfig.name || "MOVIE BOX").trim();
    const firstLetter = fullName.charAt(0);
    const restLetters = fullName.slice(1);

    useEffect(() => {
        if (window.location.pathname.startsWith("/admin")) return;
        if (window.location.pathname.startsWith("/watch")) return;
        try {
            if (sessionStorage.getItem("splash-shown")) return;
        } catch (_) {}

        setVisible(true);

        const start = Date.now();
        const tick = setInterval(() => {
            const elapsed = Date.now() - start;
            setProgress(Math.min((elapsed / DURATION) * 100, 100));
        }, 30);

        const timers = [
            setTimeout(() => setStage(1), T_SHIFT),
            setTimeout(() => setStage(2), T_M),
            setTimeout(() => setStage(3), T_REST),
            setTimeout(() => setStage(4), T_BY),
            setTimeout(() => {
                clearInterval(tick);
                setProgress(100);
                setVisible(false);
                try { sessionStorage.setItem("splash-shown", "1"); } catch (_) {}
            }, DURATION),
        ];

        return () => {
            timers.forEach(clearTimeout);
            clearInterval(tick);
        };
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.14, filter: "blur(8px)" }}
                    transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
                    className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden"
                    style={{ background: "#04070f" }}
                >
                    {/* Ambient glow */}
                    <motion.div
                        className="absolute inset-0 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.2 }}
                        style={{
                            background:
                                "radial-gradient(ellipse 55% 45% at 50% 45%, rgba(255,138,0,0.20) 0%, rgba(46,155,255,0.14) 42%, transparent 74%)",
                        }}
                    />

                    {/* Cinema light sweep */}
                    <motion.div
                        className="absolute top-0 h-full w-[45%] pointer-events-none"
                        initial={{ x: "-120%", opacity: 0 }}
                        animate={{ x: ["-120%", "220%"], opacity: [0, 0.85, 0] }}
                        transition={{ duration: 1.6, ease: "easeInOut", delay: 0.1 }}
                        style={{
                            background:
                                "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.10) 45%, rgba(255,201,60,0.24) 50%, rgba(255,255,255,0.10) 55%, transparent 100%)",
                            filter: "blur(14px)",
                        }}
                    />

                    {/* Expanding rings */}
                    {[0, 0.5, 1].map((d) => (
                        <motion.div
                            key={d}
                            className="absolute rounded-full border border-orange-400/20"
                            initial={{ width: 110, height: 110, opacity: 0 }}
                            animate={{ width: [110, 520], height: [110, 520], opacity: [0.5, 0] }}
                            transition={{ duration: 2.6, delay: 0.7 + d, repeat: Infinity, ease: "easeOut" }}
                        />
                    ))}

                    {/* Stage: icon + name */}
                    <div className="relative z-10 flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 2.7, opacity: 0, rotate: -14, filter: "blur(16px)", y: 46 }}
                            animate={
                                stage >= 1
                                    ? { scale: 1, opacity: 1, rotate: 0, filter: "blur(0px)", y: 0 }
                                    : { scale: 1.25, opacity: 1, rotate: 0, filter: "blur(0px)", y: 46 }
                            }
                            transition={{ duration: stage >= 1 ? 0.7 : 0.9, ease: [0.16, 1, 0.3, 1], delay: stage >= 1 ? 0 : T_ICON / 1000 }}
                            className="mb-5"
                        >
                            <motion.img
                                src="/moviebox-icon.png"
                                alt={`${fullName} logo`}
                                className="h-24 w-24 sm:h-28 sm:w-28 rounded-[22px] object-cover"
                                animate={{
                                    filter: [
                                        "drop-shadow(0 0 0px rgba(255,138,0,0))",
                                        "drop-shadow(0 0 42px rgba(255,138,0,0.9))",
                                        "drop-shadow(0 0 18px rgba(46,155,255,0.55))",
                                    ],
                                }}
                                transition={{ duration: 1.6, delay: 0.8 }}
                            />
                        </motion.div>

                        {/* MOVIE BOX — M drops first, rest unrolls out of it */}
                        <div className="flex items-center justify-center min-h-[52px] overflow-hidden">
                            <AnimatePresence>
                                {stage >= 2 && (
                                    <motion.span
                                        key="first"
                                        initial={{ opacity: 0, y: -46, scale: 1.7, filter: "blur(10px)" }}
                                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                        className="text-[34px] sm:text-[48px] font-black leading-none"
                                        style={{
                                            background: "linear-gradient(135deg, #FFFFFF 0%, #FFD9A0 50%, #FF8A00 100%)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                            backgroundClip: "text",
                                        }}
                                    >
                                        {firstLetter}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            <div className="flex overflow-hidden">
                                {restLetters.split("").map((ch, i) => (
                                    <motion.span
                                        key={`${ch}-${i}`}
                                        initial={{ opacity: 0, x: -26, filter: "blur(6px)" }}
                                        animate={
                                            stage >= 3
                                                ? { opacity: 1, x: 0, filter: "blur(0px)" }
                                                : { opacity: 0, x: -26, filter: "blur(6px)" }
                                        }
                                        transition={{ duration: 0.42, delay: stage >= 3 ? i * 0.055 : 0, ease: [0.16, 1, 0.3, 1] }}
                                        className="text-[34px] sm:text-[48px] font-black leading-none"
                                        style={{
                                            background: "linear-gradient(135deg, #FFFFFF 0%, #FFC93C 55%, #2E9BFF 100%)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                            backgroundClip: "text",
                                            whiteSpace: "pre",
                                        }}
                                    >
                                        {ch}
                                    </motion.span>
                                ))}
                            </div>
                        </div>

                        {/* by Beta Bot Hub */}
                        <AnimatePresence>
                            {stage >= 4 && (
                                <motion.p
                                    initial={{ opacity: 0, y: 12, letterSpacing: "0.6em" }}
                                    animate={{ opacity: 0.9, y: 0, letterSpacing: "0.3em" }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="mt-3 text-[10px] sm:text-[12px] font-bold uppercase text-amber-300/90"
                                >
                                    {siteConfig.brandBy}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Progress bar */}
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 200 }}
                        transition={{ delay: 0.6, duration: 0.6 }}
                        className="relative z-10 mt-12 h-[3px] rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.10)" }}
                    >
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${progress}%`,
                                background: "linear-gradient(90deg, #FF8A00, #FFC93C, #2E9BFF)",
                                boxShadow: "0 0 10px rgba(255,138,0,0.7)",
                                transition: "width 0.03s linear",
                            }}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
