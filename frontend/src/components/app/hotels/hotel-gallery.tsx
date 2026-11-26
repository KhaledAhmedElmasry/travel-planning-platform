// HotelGallery
// Part: T2 Hotels + my posts list
// Requirements: HTL-02
// Used by: P-18
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
import { BedDoubleIcon } from "lucide-react";

type HotelPhoto = { id: string; url: string };

type HotelGalleryProps = {
  hotelName: string;
  photos: HotelPhoto[];
};

export function HotelGallery({ hotelName, photos }: HotelGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="grid min-h-56 place-items-center rounded-xl border border-border bg-muted">
        <BedDoubleIcon className="size-12 text-subtle-foreground" aria-hidden="true" />
        <span className="sr-only">No photos available for {hotelName}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted sm:aspect-auto sm:min-h-80">
        {/* eslint-disable-next-line @next/next/no-img-element -- hotel uploads are backend-hosted URLs. */}
        <img src={photos[0].url} alt={`${hotelName} photo 1`} className="size-full object-cover" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
        {photos.slice(1, 3).map((photo, index) => (
          <div key={photo.id} className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted sm:aspect-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- hotel uploads are backend-hosted URLs. */}
            <img src={photo.url} alt={`${hotelName} photo ${index + 2}`} className="size-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}
