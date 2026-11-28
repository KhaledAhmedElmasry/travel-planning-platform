"use client";

// Hotel profile form (P-42: HTL-01 edit the hotel, GEN-08 photos, GEN-12 country and city from the reference lists).
// One multipart PATCH /api/hotels/{id} saves everything with the Save button (the API has no separate photo route):
// text fields, `amenities` (one field per amenity, replaces the list), new `photos`, and `removePhotoIds`.
// Photos: JPG/PNG, up to 5 MB, up to 5 in total (the kit ImageUploader checks, the backend checks again, GEN-08).
// Country -> city: the cities of the chosen country come from GET /api/cities?country=XX (GEN-12).
// Errors under each field (GEN-02). "Discard changes" goes back to the saved hotel without leaving the page (GEN-14).
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { ImageUploader, type ExistingImage } from "@/components/app/image-uploader";
import { NumberStepper } from "@/components/app/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

/** GET /api/hotels/{id} (openapi): the fields this form edits. */
export type HotelProfile = {
  id: string;
  name: string;
  address: string;
  cityId: string;
  countryCode: string;
  description: string;
  starRating: number;
  photos: { id: string; url: string }[];
  amenities: string[];
};
export type Country = { code: string; name: string };
export type City = { cityId: string; name: string };

type Errors = { message?: string; fields: Record<string, string> };
type NewPhoto = { id: string; url: string; file: File };

const LABELS = {
  name: "Hotel name",
  address: "Address",
  countryCode: "Country",
  cityId: "City",
  description: "Description",
  amenities: "Amenities",
  photos: "Photos",
};

type Props = { hotel: HotelProfile; countries: Country[]; initialCities: City[] };

export function HotelProfileForm({ hotel, countries, initialCities }: Props) {
  const router = useRouter();
  const [name, setName] = useState(hotel.name);
  const [address, setAddress] = useState(hotel.address);
  const [countryCode, setCountryCode] = useState(hotel.countryCode);
  const [cityId, setCityId] = useState(hotel.cityId);
  const [cities, setCities] = useState<City[]>(initialCities);
  const [loadingCities, setLoadingCities] = useState(false);
  const [description, setDescription] = useState(hotel.description);
  const [stars, setStars] = useState(hotel.starRating);
  const [amenities, setAmenities] = useState<string[]>(hotel.amenities);
  const [draft, setDraft] = useState("");
  const [amenityError, setAmenityError] = useState<string | undefined>();
  const [kept, setKept] = useState(hotel.photos);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<NewPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors | null>(null);
  const photoSeq = useRef(0);
  const citiesRequest = useRef(0);

  async function loadCities(code: string) {
    const request = ++citiesRequest.current;
    setLoadingCities(true);
    try {
      const all: City[] = [];
      for (let page = 1; ; page++) {
        const res = await apiFetch<{ items: City[]; totalPages: number }>(
          `/api/cities?country=${encodeURIComponent(code)}&page=${page}`,
        );
        all.push(...res.items);
        if (page >= res.totalPages) break;
      }
      if (request === citiesRequest.current) setCities(all);
    } catch {
      if (request === citiesRequest.current) {
        setCities([]);
        toast.error("We couldn't load the cities. Choose the country again.");
      }
    } finally {
      if (request === citiesRequest.current) setLoadingCities(false);
    }
  }

  function changeCountry(code: string) {
    setCountryCode(code);
    setCityId("");
    setCities([]);
    void loadCities(code);
  }

  function addAmenity() {
    const value = draft.trim();
    if (value === "") return;
    if (value.length > 50) return setAmenityError("Use at most 50 characters.");
    if (value.includes(",")) return setAmenityError("An amenity cannot contain a comma.");
    if (amenities.some((item) => item.toLowerCase() === value.toLowerCase())) {
      return setAmenityError("This amenity is already in the list.");
    }
    setAmenities((list) => [...list, value]);
    setDraft("");
    setAmenityError(undefined);
  }

  function onAmenityKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addAmenity();
    }
  }

  function addPhotos(files: File[]) {
    setAdded((list) => [
      ...list,
      ...files.map((file) => ({ id: `new-${photoSeq.current++}`, url: URL.createObjectURL(file), file })),
    ]);
  }

  function removePhoto(id: string) {
    const fresh = added.find((photo) => photo.id === id);
    if (fresh) {
      URL.revokeObjectURL(fresh.url);
      setAdded((list) => list.filter((photo) => photo.id !== id));
      return;
    }
    setKept((list) => list.filter((photo) => photo.id !== id));
    setRemovedIds((list) => [...list, id]);
  }

  function discard() {
    added.forEach((photo) => URL.revokeObjectURL(photo.url));
    setName(hotel.name);
    setAddress(hotel.address);
    setCountryCode(hotel.countryCode);
    setCityId(hotel.cityId);
    citiesRequest.current++;
    setCities(initialCities);
    setLoadingCities(false);
    setDescription(hotel.description);
    setStars(hotel.starRating);
    setAmenities(hotel.amenities);
    setDraft("");
    setAmenityError(undefined);
    setKept(hotel.photos);
    setRemovedIds([]);
    setAdded([]);
    setErrors(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const fields: Record<string, string> = {};
    if (name.trim() === "") fields.name = "Enter the hotel name.";
    else if (name.trim().length > 100) fields.name = "Use at most 100 characters.";
    if (address.trim() === "") fields.address = "Enter the address.";
    else if (address.trim().length > 200) fields.address = "Use at most 200 characters.";
    if (!countryCode) fields.countryCode = "Choose a country.";
    if (!cityId) fields.cityId = "Choose a city.";
    if (description.trim() === "") fields.description = "Enter a description.";
    else if (description.trim().length > 2000) fields.description = "Use at most 2000 characters.";
    // The backend reads an empty amenity list as "not changed", so it cannot be saved empty.
    if (hotel.amenities.length > 0 && amenities.length === 0) {
      fields.amenities = "Keep at least one amenity. An empty list cannot be saved.";
    }
    if (Object.keys(fields).length > 0) {
      setErrors({ fields });
      return;
    }

    setErrors(null);
    setSubmitting(true);
    const body = new FormData();
    body.append("name", name.trim());
    body.append("address", address.trim());
    body.append("countryCode", countryCode);
    body.append("cityId", cityId);
    body.append("description", description.trim());
    body.append("starRating", String(stars));
    amenities.forEach((amenity) => body.append("amenities", amenity));
    removedIds.forEach((id) => body.append("removePhotoIds", id));
    added.forEach((photo) => body.append("photos", photo.file));
    try {
      await apiFetch(`/api/hotels/${encodeURIComponent(hotel.id)}`, { method: "PATCH", body });
      toast.success("Hotel saved");
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const mapped = fieldErrorMap(err.body);
      if (err.status === 400 && /photo/i.test(err.message) && !mapped.photos) mapped.photos = err.message;
      setErrors({ message: err.message, fields: mapped });
    } finally {
      setSubmitting(false);
    }
  }

  const images: ExistingImage[] = [...kept, ...added].map((photo) => ({ id: photo.id, url: photo.url }));

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-6">
      {errors && <FormErrorSummary message={errors.message} errors={errors.fields} labels={LABELS} />}
      <FormField label="Hotel name" name="name" required error={errors?.fields.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </FormField>
      <FormField label="Address" name="address" required error={errors?.fields.address}>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Selects outside FormField: FormField labels its direct child, which must be the trigger button. */}
        <Select value={countryCode} onValueChange={changeCountry}>
          <FormField label="Country" name="countryCode" required error={errors?.fields.countryCode}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a country" />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityId} onValueChange={setCityId} disabled={loadingCities || cities.length === 0}>
          <FormField
            label="City"
            name="cityId"
            required
            hint={loadingCities ? "Loading cities..." : undefined}
            error={errors?.fields.cityId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a city" />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.cityId} value={city.cityId}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <NumberStepper label="Star class" hint="1 to 5 stars" value={stars} min={1} max={5} onChange={setStars} />
      <FormField label="Description" name="description" required error={errors?.fields.description}>
        <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </FormField>
      <div className="grid gap-3">
        <div className="flex items-start gap-2">
          <FormField
            label="Amenities"
            name="amenities"
            hint="Press Enter or Add. Up to 50 characters each, no commas."
            error={amenityError ?? errors?.fields.amenities}
            className="flex-1"
          >
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setAmenityError(undefined);
              }}
              onKeyDown={onAmenityKey}
            />
          </FormField>
          <Button type="button" variant="secondary" className="mt-6" onClick={addAmenity}>
            Add
          </Button>
        </div>
        {amenities.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Amenities of the hotel">
            {amenities.map((amenity) => (
              <li key={amenity} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-1.5 pl-3 text-sm">
                {amenity}
                <button
                  type="button"
                  aria-label={`Remove ${amenity}`}
                  onClick={() => setAmenities((list) => list.filter((item) => item !== amenity))}
                  className="grid size-6 place-items-center rounded-full hover:bg-background"
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FormField
        label="Photos"
        name="photos"
        hint="JPG or PNG, up to 5 MB each, up to 5 photos. Changes are saved with Save hotel."
        error={errors?.fields.photos}
      >
        <ImageUploader max={5} existing={images} onAdd={addPhotos} onRemove={removePhoto} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          Save hotel
        </Button>
        <Button type="button" variant="ghost" onClick={discard} disabled={submitting}>
          Discard changes
        </Button>
      </div>
    </form>
  );
}
