"use client";

import { FormEvent, useState } from "react";

type FormState = {
  companyName: string;
  contactName: string;
  businessEmail: string;
  operationalNote: string;
};

const emptyForm: FormState = {
  companyName: "",
  contactName: "",
  businessEmail: "",
  operationalNote: "",
};

export function RequestAccessForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/company-access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          contactName: form.contactName,
          businessEmail: form.businessEmail,
          operationalNote: form.operationalNote || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Please wait before trying again."
            : "We could not submit your request. Please check the details and try again.",
        );
      }
      setSubmitted(true);
      setForm(emptyForm);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not submit your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-3xl border border-teal-200 bg-teal-50 p-6"
        role="status"
        aria-live="polite"
      >
        <h2 className="font-heading text-2xl font-black text-slate-950">
          Request received
        </h2>
        <p className="mb-0 text-slate-700">
          If your request is eligible, our team will contact you at the business
          email provided. Submitting this form does not create an active Oasis
          organization or user account.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <label
          className="mb-2 block text-sm font-bold text-slate-800"
          htmlFor="companyName"
        >
          Care company name
        </label>
        <input
          className="w-full"
          id="companyName"
          name="companyName"
          required
          maxLength={200}
          autoComplete="organization"
          value={form.companyName}
          onChange={(event) =>
            setForm({ ...form, companyName: event.target.value })
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-bold text-slate-800"
          htmlFor="contactName"
        >
          Contact name
        </label>
        <input
          className="w-full"
          id="contactName"
          name="contactName"
          required
          maxLength={200}
          autoComplete="name"
          value={form.contactName}
          onChange={(event) =>
            setForm({ ...form, contactName: event.target.value })
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-bold text-slate-800"
          htmlFor="businessEmail"
        >
          Business email
        </label>
        <input
          className="w-full"
          id="businessEmail"
          name="businessEmail"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          value={form.businessEmail}
          onChange={(event) =>
            setForm({ ...form, businessEmail: event.target.value })
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-bold text-slate-800"
          htmlFor="operationalNote"
        >
          Operational note{" "}
          <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          className="min-h-28 w-full"
          id="operationalNote"
          name="operationalNote"
          maxLength={500}
          aria-describedby="note-help"
          value={form.operationalNote}
          onChange={(event) =>
            setForm({ ...form, operationalNote: event.target.value })
          }
        />
        <p id="note-help" className="mb-0 mt-2 text-sm text-slate-600">
          Share only high-level operational context, such as your service area
          or approximate team size.
        </p>
      </div>

      <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        We’ll use these business contact details to review and respond to your
        request. Do not include information about people receiving care, medical
        details, clinical information, or care records.
      </div>

      {error && (
        <p
          className="mb-0 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-teal-700 px-6 py-3 font-bold text-white shadow-lg shadow-teal-900/15 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Request Oasis access"}
      </button>
    </form>
  );
}
