import Image from "next/image";
import Link from "next/link";
import { CalendarIcon, MapPinIcon } from "lucide-react";

export interface EventCardProps {
  event: {
    id: string;
    title: string;
    location: string | null;
    startDate: Date;
    coverImageUrl: string | null;
    isPublished: boolean;
    _count?: {
      albums: number;
    };
  };
}

export default function EventCard({ event }: EventCardProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(event.startDate));

  return (
    <Link href={`/events/${event.id}`} className="block h-full">
      <div className="dark:bg-gray-950 border rounded-xl hover:shadow-md transition-shadow overflow-hidden h-full flex flex-col bg-white">
        <div className="relative aspect-video w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          {event.coverImageUrl ? (
            <Image 
              unoptimized={true}
              src={event.coverImageUrl} 
              fill 
              alt={event.title} 
              className="object-cover" 
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-400 font-medium bg-gray-100 dark:bg-gray-800">
              No Image
            </div>
          )}
          <div className="absolute top-3 right-3">
            {event.isPublished ? (
              <span className="px-2 py-1 text-xs font-semibold bg-green-500 text-white rounded-full shadow-sm">
                Published
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold bg-yellow-500 text-white rounded-full shadow-sm">
                Draft
              </span>
            )}
          </div>
        </div>
        
        <div className="p-5 flex flex-col flex-grow">
          <h3 className="font-bold text-lg mb-2 line-clamp-1">{event.title}</h3>
          
          <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 flex-shrink-0" />
              <span className="line-clamp-1">{formattedDate}</span>
            </div>
            
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-sm text-gray-500">
            <span>{event._count?.albums || 0} Albums</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
              View Details &rarr;
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
