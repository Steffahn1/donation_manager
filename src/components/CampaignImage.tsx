/* eslint-disable @next/next/no-img-element */

/**
 * Campaign images are static files in /public (uploading is future work).
 * If no image is set we show a neutral placeholder instead of a broken image.
 */
export function CampaignImage({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-emerald-100 to-sky-100 text-sm text-emerald-900 ${className}`}>
        {alt}
      </div>
    );
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}
