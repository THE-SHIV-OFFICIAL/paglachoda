const FWIcon = ({ className = "h-8 w-8" }: { className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
        src="/moviebox-icon.png"
        alt="Movie Box logo"
        className={`${className} rounded-[10px] object-cover`}
    />
);

export default FWIcon;
