import { siteConfig } from "@/lib/config";

const FWIconInline = ({ className = "h-8 w-8" }: { className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
        src="/moviebox-icon.png"
        alt={`${siteConfig.name} logo`}
        className={`${className} rounded-[10px] object-cover`}
    />
);

interface BrandLogoProps {
    iconClass?: string;
    textClass?: string;
    hideText?: boolean;
    showBy?: boolean;
    stacked?: boolean;
}

const BrandName = ({ textClass }: { textClass: string }) => {
    const name = siteConfig.name;
    const parts = name.split(" ");
    const first = parts[0];
    const rest = parts.slice(1).join(" ");

    return (
        <span
            className={`${textClass} font-black tracking-tight leading-none whitespace-nowrap`}
            style={{ color: "var(--foreground)" }}
        >
            {first}
            {rest && (
                <>
                    {" "}
                    <span
                        style={{
                            background: "linear-gradient(135deg, #FF8A00 0%, #FFC93C 45%, #2E9BFF 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                        }}
                    >
                        {rest}
                    </span>
                </>
            )}
        </span>
    );
};

const BrandLogo = ({
    iconClass = "h-8 w-8",
    textClass = "text-[17px]",
    hideText = false,
    showBy = false,
    stacked = false,
}: BrandLogoProps) => {
    if (stacked) {
        return (
            <span className="flex flex-col items-center gap-1">
                <FWIconInline className={`${iconClass} flex-shrink-0`} />
                {!hideText && (
                    <>
                        <BrandName textClass={textClass} />
                        {showBy && (
                            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                {siteConfig.brandBy}
                            </span>
                        )}
                    </>
                )}
            </span>
        );
    }

    return (
        <span className="flex items-center gap-2">
            <FWIconInline className={`${iconClass} flex-shrink-0`} />
            {!hideText && (
                <span className="flex flex-col leading-none">
                    <BrandName textClass={textClass} />
                    {showBy && (
                        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                            {siteConfig.brandBy}
                        </span>
                    )}
                </span>
            )}
        </span>
    );
};

export default BrandLogo;
export { FWIconInline };
