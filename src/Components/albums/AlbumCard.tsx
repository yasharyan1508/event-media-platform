import Link from "next/link";
import Image from "next/image";

interface AlbumCardProps {
  id: string;
  title: string;
  description?: string | null;
  mediaCount: number;
  coverUrl?: string | null;
  createdAt: string | Date;
  eventId: string;
}

export function AlbumCard({
  id,
  title,
  description,
  mediaCount,
  coverUrl,
  createdAt,
  eventId,
}: AlbumCardProps) {
  const dateObj = new Date(createdAt);
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(dateObj);

  return (
    <Link href={`/events/${eventId}/albums/${id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-surface-elevated shadow-sm ring-1 ring-white/5 transition-all hover:shadow-md hover:ring-primary/30 h-full flex flex-col">
        <div className="aspect-[4/3] w-full relative bg-gradient-to-br from-surface to-surface-sunken shrink-0">
          {coverUrl ? (
            <Image
              unoptimized={true}
              src={coverUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-elevated text-on-surface-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {mediaCount} {mediaCount === 1 ? 'item' : 'items'}
          </div>
        </div>
        
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="font-heading text-lg font-semibold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm text-on-surface-muted line-clamp-2">
              {description}
            </p>
          )}
          <p className="mt-auto pt-3 text-xs text-on-surface-subtle">
            Created {formattedDate}
          </p>
        </div>
      </div>
    </Link>
  );
}
