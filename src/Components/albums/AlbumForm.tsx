"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";

import { createAlbum } from "@/src/Action/album/create-album";
import { updateAlbum } from "@/src/Action/album/update-album";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/Components/UI/form";
import { Input } from "@/src/Components/UI/input";
import { Textarea } from "@/src/Components/UI/textarea";
import { Button } from "@/src/Components/UI/button";

const formSchema = z.object({
  title: z.string().min(1, "Title required").max(100),
  description: z.string().max(500).optional(),
});

type AlbumFormValues = z.infer<typeof formSchema>;

interface AlbumFormProps {
  eventId: string;
  mode: "create" | "edit";
  initialData?: { id: string; title: string; description?: string | null };
  onSuccess?: (albumId: string) => void;
}

export function AlbumForm({ eventId, mode, initialData, onSuccess }: AlbumFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AlbumFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
    },
  });

  async function onSubmit(values: AlbumFormValues) {
    setError(null);

    try {
      if (mode === "create") {
        const result = await createAlbum({
          title: values.title,
          description: values.description || undefined,
          eventId,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.success && result.albumId) {
          if (onSuccess) {
            onSuccess(result.albumId);
          } else {
            router.push(`/events/${eventId}/albums/${result.albumId}`);
          }
        }
      } else if (mode === "edit" && initialData?.id) {
        const result = await updateAlbum({
          id: initialData.id,
          title: values.title,
          description: values.description || undefined,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.success) {
          if (onSuccess) {
            onSuccess(initialData.id);
          } else {
            router.refresh();
          }
        }
      }
    } catch (e) {
      console.error(e);
      setError("An unexpected error occurred");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="p-3 text-sm font-medium text-red-500 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Album Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Wedding Reception" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about these photos..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Saving..."
            : mode === "create"
            ? "Create Album"
            : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}
