/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { X, Upload, Image as IconImage, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image";

interface PhotoUploadProps {
  name: string;
  maxPhotos?: number;
  label?: string;
}

interface PhotoItem {
  id: string;
  file?: File;
  preview: string;
  isCover: boolean;
}

// ponytail: BE ImageMagick WASM has no HEIC codec — uploads would be silently dropped; widen this set if the BE gains one
export const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const UNSUPPORTED_FILE_MESSAGE = "Unsupported image format. Please use PNG, JPG, JPEG, or WEBP.";
export const IMAGE_PROCESS_ERROR = "Could not process this image. Please try another file.";

const readAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Files over 2MB are compressed to WEBP before upload.
const preparePhoto = async (file: File) => {
  const compressed = await compressImage(file);
  return { file: compressed, preview: await readAsDataURL(compressed) };
};

// Compact inline photo cell for bulk table rows — pick/preview/remove in 40px, no dialog.
// Photo value shape matches PhotoItem[] so createFormData single-photo extraction works.
export const InlinePhotoCell = ({ name }: { name: string }) => {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const items = (field.value ?? []) as { file?: File; preview?: string }[];
        const preview = items[0]?.preview;
        return (
          <FormItem className="justify-self-center">
            <FormControl>
              {preview ? (
                <div className="relative w-10 h-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Variant photo" className="w-full h-full object-cover rounded-md border border-gray-200" />
                  <button
                    type="button"
                    aria-label="Remove variant photo"
                    onClick={() => field.onChange([])}
                    className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border border-gray-200"
                  >
                    <X size={12} className="text-destructive" />
                  </button>
                </div>
              ) : (
                <label className="flex w-10 h-10 flex-col items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400 cursor-pointer hover:border-brand-500 hover:text-brand-500 transition-colors">
                  <ImagePlus size={16} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
                        toast.error(UNSUPPORTED_FILE_MESSAGE, { position: "top-center" });
                        return;
                      }
                      preparePhoto(file)
                        .then(({ file: prepared, preview }) =>
                          field.onChange([{ id: `${name}-0`, file: prepared, preview, isCover: true }]),
                        )
                        .catch(() => toast.error(IMAGE_PROCESS_ERROR, { position: "top-center" }));
                    }}
                  />
                </label>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};

export function PhotoUploadForm({ name, maxPhotos = 4, label = "Photo Product" }: PhotoUploadProps) {
  const { control, watch } = useFormContext();
  const [dragActive, setDragActive] = useState(false);
  const [typeError, setTypeError] = useState(false);

  const fieldValue = watch(name) || [];
  const photos: PhotoItem[] = Array.isArray(fieldValue) ? fieldValue : [];

  // Generate unique ID for each photo
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFiles = useCallback(
    async (files: FileList | null, currentPhotos: PhotoItem[], onComplete: (photos: PhotoItem[]) => void) => {
      if (!files || files.length === 0) {
        onComplete(currentPhotos);
        return;
      }

      const remainingSlots = maxPhotos - currentPhotos.length;
      const validFiles = Array.from(files)
        .slice(0, remainingSlots)
        .filter((file) => SUPPORTED_IMAGE_TYPES.has(file.type));

      setTypeError(validFiles.length === 0 && Array.from(files).length > 0);

      if (validFiles.length === 0) {
        onComplete(currentPhotos);
        return;
      }

      const prepared = await Promise.all(
        validFiles.map(async (file) => {
          try {
            return await preparePhoto(file);
          } catch {
            return null;
          }
        }),
      );
      if (prepared.some((photo) => !photo)) toast.error(IMAGE_PROCESS_ERROR, { position: "top-center" });

      const newPhotos = [...currentPhotos];
      prepared.forEach((photo) => {
        if (!photo) return;
        newPhotos.push({
          id: generateId(),
          file: photo.file,
          preview: photo.preview,
          isCover: newPhotos.length === 1, // First photo is cover by default
        });
      });
      onComplete(newPhotos);
    },
    [maxPhotos],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, onChange: any) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      processFiles(e.dataTransfer.files, photos, onChange);
    },
    [photos, processFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, onChange: any) => {
      processFiles(e.target.files, photos, onChange);
      e.target.value = ""; // Reset input
    },
    [photos, processFiles],
  );

  const removePhoto = useCallback(
    (id: string, onChange: any) => {
      const updated = photos.filter((p) => p.id !== id);
      // Ensure at least one cover photo
      if (updated.length > 0 && !updated.some((p) => p.isCover)) {
        updated[0].isCover = true;
      }
      onChange(updated);
    },
    [photos],
  );

  const setAsCover = useCallback(
    (id: string, onChange: any) => {
      const updated = photos.map((p) => ({
        ...p,
        isCover: p.id === id,
      }));
      onChange(updated);
    },
    [photos],
  );

  const replacePhoto = useCallback(
    (id: string, onChange: any) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
          toast.error(UNSUPPORTED_FILE_MESSAGE, { position: "top-center" });
          return;
        }
        preparePhoto(file)
          .then(({ file: prepared, preview }) => {
            onChange(photos.map((p) => (p.id === id ? { ...p, file: prepared, preview } : p)));
          })
          .catch(() => toast.error(IMAGE_PROCESS_ERROR, { position: "top-center" }));
      };
      input.click();
    },
    [photos],
  );

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={[]}
      render={({ field: { onChange } }) => (
        <div className="w-full">
          <h2 className="text-lg font-semibold mb-4">{label}</h2>

          <div className="flex flex-wrap gap-4">
            {/* Upload Area */}
            {photos.length < maxPhotos && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={(e) => handleDrop(e, onChange)}
                className={`relative w-[250px] h-[250px] rounded-lg border border-dashed transition-colors border-brand-400 ${dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30"
                  }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFileInput(e, onChange)}
                  className="hidden"
                  id={`photo-input-${name}`}
                />

                <label htmlFor={`photo-input-${name}`} className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                  <IconImage className="w-8 h-8 text-muted-foreground mb-2" color="var(--color-brand-500)" />
                  <div className="text-center text-sm ">
                    <p className=" text-brand-500 font-semibold">Click to Upload</p>
                    <p className="text-muted-foreground">or Drag and drop</p>
                  </div>
                </label>
              </div>
            )}

            {/* Photo Grid */}
            {photos.map((photo) => (
              <div key={photo.id} className="relative w-[250px] h-[250px] rounded-lg overflow-hidden group">
                {/* ponytail: plain img — next/image optimizer hard-404s on data URLs / storage hosts the admin previews */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview || "/placeholder.svg"} alt="Product photo" className="absolute inset-0 w-full h-full object-cover" />

                {/* Cover Badge */}
                {photo.isCover && <div className="absolute bottom-2 right-2 bg-teal-600 text-white px-2 py-1 rounded text-xs font-medium">COVER</div>}

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => replacePhoto(photo.id, onChange)}
                    className="bg-white text-primary hover:bg-white/90"
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => removePhoto(photo.id, onChange)}
                    className="bg-white text-primary hover:bg-white/90"
                  >
                    Remove
                  </Button>
                  {!photo.isCover && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setAsCover(photo.id, onChange)}
                      className="bg-white text-primary hover:bg-white/90"
                    >
                      Set as Cover
                    </Button>
                  )}
                </div>

                {/* Quick Remove Button */}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id, onChange)}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove photo"
                >
                  <X className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>

          {/* Info Text */}
          {typeError ? (
            <p className="text-sm text-destructive mt-4">{UNSUPPORTED_FILE_MESSAGE}</p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-3">
            PNG, JPG, JPEG, or WEBP &middot; {maxPhotos} max &middot; max 2 MB, larger images are compressed to WEBP on upload
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {photos.length}/{maxPhotos} photos uploaded
          </p>
        </div>
      )}
    />
  );
}