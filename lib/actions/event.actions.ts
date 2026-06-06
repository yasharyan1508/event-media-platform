"use server"

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/Library/prisma";

type CreateEventParams = {
  event: {
    title: string;
    description: string;
    location: string;
    startDateTime: Date;
    endDateTime: Date;
    categoryId: string;
    price: string;
    isFree: boolean;
    url?: string;
  };
  userId: string;
  path: string;
};

export async function createEvent({ event, userId, path }: CreateEventParams) {
  try {
    const newEvent = await prisma.event.create({
      data: {
        title: event.title,
        description: event.description,
        location: event.location,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        price: event.price,
        isFree: event.isFree,
        url: event.url,
        category: {
          connect: { id: event.categoryId }
        },
        organizer: {
          connect: { id: userId }
        },
        // 'owner' is still a required relation on the Event model
        owner: {
          connect: { id: userId }
        }
      }
    });

    revalidatePath(path);
    return JSON.parse(JSON.stringify(newEvent));
  } catch (error) {
    console.error("Error creating event:", error);
    throw new Error("Failed to create event");
  }
}
