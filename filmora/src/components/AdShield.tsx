"use client";

import { useEffect } from "react";
import { installAdShield } from "@/lib/adShield";

export default function AdShield() {
    useEffect(() => {
        // Installed for the whole session; the shield is reference counted so a
        // player unmounting can never switch it off.
        installAdShield();
    }, []);
    return null;
}
