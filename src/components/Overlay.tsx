import { useEffect } from "react";

const BodyLock = () => {
  useEffect(() => {
    if (document?.body?.style) {
      document.body.style.cssText = `
      overflow: hidden;
    `;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.cssText = `
        overflow: visible;
        overflow: overlay;
      `;
      };
    }

    return undefined;
  }, []);

  return null;
};

interface OverlayProps extends React.ComponentProps<"div"> {
  isUnmounting?: boolean;
}

export const Overlay: React.FC<React.PropsWithChildren<OverlayProps>> = (props) => {
  return (
    <>
      <BodyLock />
      <div
        role="presentation"
        className="fixed inset-0 w-full h-full pointer-events-auto"
        {...props}
      />
    </>
  );
};

export default Overlay;
