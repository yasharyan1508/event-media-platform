"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/src/Components/UI/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/Components/UI/form"
import { Input } from "@/src/Components/UI/input"
import { Textarea } from "@/src/Components/UI/textarea"
import { Checkbox } from "@/src/Components/UI/checkbox"
import { createEventSchema } from "@/src/Schemas/event/event.schema"
import { createEvent } from "@/src/Action/event/create-event"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { FileUploader } from "@/src/Components/shared/FileUploader"

type EventFormProps = {
  type: "Create" | "Update"
  event?: any
  userId: string
}

export function EventForm({ type, event, userId }: EventFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const initialValues = event && type === "Update"
    ? {
      ...event,
      startDateTime: new Date(event.startDateTime),
      endDateTime: new Date(event.endDateTime),
    }
    : {
      title: "",
      description: "",
      location: "",
      coverImageS3Key: "",
      startDateTime: new Date(),
      endDateTime: new Date(),
      categoryId: "", // Temporarily required by schema
      price: "",
      isFree: false,
      url: "",
    }

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: initialValues,
  })

  async function onSubmit(values: z.infer<typeof createEventSchema>) {
    setIsPending(true)
    try {
      if (type === "Create") {
        const result = await createEvent(values);
        if ("error" in result) {
          alert(result.error);
          return;
        }
        router.push(`/events/${result.eventId}`)
      } else {
        console.log("Update event", values)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsPending(false)
    }
  }

  function formatDateForInput(value: string | null | undefined): string {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 16);
  }

  const title = useWatch({ control: form.control, name: "title" }) || "Terra Sustainable Living Expo"
  const location = useWatch({ control: form.control, name: "location" }) || "The Botanical Gardens, SF"
  const startDateTime = useWatch({ control: form.control, name: "startDateTime" })
  const endDateTime = useWatch({ control: form.control, name: "endDateTime" })
  const price = useWatch({ control: form.control, name: "price" })
  const isFree = useWatch({ control: form.control, name: "isFree" })
  const coverImageS3Key = useWatch({ control: form.control, name: "coverImageS3Key" })

  const previewMonth = startDateTime ? new Date(startDateTime).toLocaleString('default', { month: 'short' }) : 'Nov'
  const previewDay = startDateTime ? new Date(startDateTime).getDate() : '15'
  
  const formatTime = (d: Date | null) => {
    if (!d) return ''
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const previewTime = startDateTime && endDateTime 
    ? `${formatTime(startDateTime)} - ${formatTime(endDateTime)} PST`
    : '9:00 AM - 5:00 PM PST'

  const previewPrice = isFree ? "Free" : (price ? `$${price}` : "$299")
  const previewImage = coverImageS3Key || "https://lh3.googleusercontent.com/aida-public/AB6AXuDPaV5tAbx1Ggi-AE3f9sEe0B23xWCwQ7k2ptcB2c7QS37jNKkmtc7evQVPZElgW03UPIyW-9x6BaMnNpkSJR98hnxLw8AFssGpEccjMTScmMIV37hYnMaPh9AHN8bz5VCKRiU7KGgTOTVfytOxedhENFL_oBJficF8ZXL-klYO_4cQ3xoG_Hj58EIxR-WbRXFw2oovAZpF2-jPrx98_MOxUifmATar4vvKtdD0vBb-Zd1eLnAz27ELsQm11uMNSP3-W0dKcaRxXmU"

  if (!mounted) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center text-secondary font-semibold">
        Loading editor...
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full pb-20">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-7 space-y-8">
          <div className="glass-elevated rounded-xl p-8 space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-bold text-on-surface mb-2 font-label">Event Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Terra Sustainable Living Expo" className="h-auto w-full glass-input rounded-xl text-on-surface text-lg py-4 px-5 placeholder:text-outline/50 focus:ring-0 font-body" {...field} />
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
                  <FormLabel className="block text-sm font-bold text-on-surface mb-2 font-label">Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detail the core focus and schedule..." className="w-full glass-input rounded-xl text-on-surface py-3 px-5 placeholder:text-outline/50 focus:ring-0 resize-none font-body" rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverImageS3Key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-bold text-on-surface mb-2 font-label">Media Cover</FormLabel>
                  <FormControl>
                    <div className="w-full border-2 border-dashed border-primary/20 rounded-xl bg-surface-container-low/50 hover:bg-surface-container/50 transition-colors p-6 flex flex-col items-center justify-center group relative overflow-hidden">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-primary text-3xl">local_florist</span>
                      </div>
                      <p className="text-on-surface font-semibold mb-1 font-body">Drag & drop or click to upload cover photo</p>
                      <p className="text-secondary text-xs font-body mb-4">Natural high-res imagery preferred</p>
                      <FileUploader 
                        onFieldChange={field.onChange}
                        imageUrl={field.value || ""}
                        setFiles={setFiles}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-bold text-on-surface mb-2 font-label">Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">location_on</span>
                      <Input placeholder="Search venue or address..." className="h-auto w-full glass-input rounded-xl text-on-surface py-3 pl-12 pr-5 placeholder:text-outline/50 focus:ring-0 font-body" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="startDateTime"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel className="block text-sm font-bold text-on-surface mb-2 font-label">Start Date & Time</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">calendar_today</span>
                        <Input
                          type="datetime-local"
                          className="h-auto w-full glass-input rounded-xl text-on-surface py-3 pl-12 pr-5 focus:ring-0 font-body"
                          value={field.value ? formatDateForInput(field.value) : ""}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDateTime"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel className="block text-sm font-bold text-on-surface mb-2 font-label">End Date & Time</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">calendar_today</span>
                        <Input
                          type="datetime-local"
                          className="h-auto w-full glass-input rounded-xl text-on-surface py-3 pl-12 pr-5 focus:ring-0 font-body"
                          value={field.value ? formatDateForInput(field.value) : ""}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-outline-variant/30 pt-6">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="block text-sm font-bold text-on-surface font-label">Price ($)</FormLabel>
                      <FormField
                        control={form.control}
                        name="isFree"
                        render={({ field: freeField }) => (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-secondary font-label">Free Entry</span>
                            <FormControl>
                              <Checkbox
                                checked={freeField.value}
                                onCheckedChange={freeField.onChange}
                                className="w-5 h-5 border-2 rounded border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:text-on-primary"
                              />
                            </FormControl>
                          </div>
                        )}
                      />
                    </div>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary font-bold">$</span>
                        <Input type="number" step="0.01" placeholder="0.00" className="h-auto w-full glass-input rounded-xl text-on-surface py-3 pl-8 pr-5 placeholder:text-outline/50 focus:ring-0 font-body" disabled={isFree} {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="hidden">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button type="submit" disabled={isPending} className="w-full glow-button font-headline font-bold text-lg py-6 rounded-xl flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
            {isPending ? "Saving..." : `${type === "Create" ? "Publish" : "Update"} Rooted Experience`}
            <span className="material-symbols-outlined">nature_people</span>
          </Button>
        </div>

        {/* Right Column: Live Preview Sticky Sidebar */}
        <div className="lg:col-span-5 relative hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="flex items-center gap-2 text-secondary mb-4">
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span className="text-xs font-bold tracking-widest uppercase font-label">Live Preview</span>
            </div>

            <div className="glass-elevated rounded-xl overflow-hidden group border border-outline-variant/20 shadow-xl">
              <div className="h-56 relative overflow-hidden bg-surface-container">
                <img alt="Event cover preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" src={previewImage} />
                <div className="absolute inset-0 bg-gradient-to-t from-white/90 to-transparent"></div>
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md border border-primary/20 text-primary px-4 py-1.5 rounded-full text-xs font-extrabold shadow-sm flex items-center gap-1 font-label">
                  <span className="material-symbols-outlined text-[14px]">payments</span>
                  {previewPrice}
                </div>
              </div>

              <div className="p-8 relative">
                <div className="absolute -top-12 left-8 bg-primary/95 text-on-primary rounded-xl px-4 py-3 text-center shadow-lg w-16">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 font-label opacity-90">{previewMonth}</div>
                  <div className="text-2xl font-black leading-none font-headline">{previewDay}</div>
                </div>

                <div className="mt-4">
                  <div className="inline-flex items-center gap-1.5 text-primary text-xs font-bold bg-primary/10 px-3 py-1 rounded-full mb-4 border border-primary/20 font-label">
                    <span className="material-symbols-outlined text-[14px]">eco</span>
                    Sustainability
                  </div>

                  <h3 className="font-headline text-2xl font-bold text-on-surface mb-3 leading-tight break-words">{title}</h3>
                  
                  <div className="space-y-3 mt-5">
                    <div className="flex items-start gap-3 text-sm text-secondary font-medium font-body">
                      <span className="material-symbols-outlined text-base mt-0.5 text-primary">schedule</span>
                      <span className="">{previewTime}</span>
                    </div>

                    <div className="flex items-start gap-3 text-sm text-secondary font-medium font-body">
                      <span className="material-symbols-outlined text-base mt-0.5 text-primary">location_on</span>
                      <span className="">{location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center p-8 border border-dashed border-primary/20 rounded-xl bg-surface-container-low/50">
              <span className="material-symbols-outlined text-primary/40 text-4xl mb-3">grid_view</span>
              <p className="text-sm text-secondary font-semibold font-body">Card preview in the discovery ecosystem.</p>
            </div>
          </div>
        </div>

      </form>
    </Form>
  )
}
