'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../components/oasis/Header';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button, buttonVariants } from '../../../components/ui/Button';
import { clientQuery } from '../../../lib/graphql/client-side';

const CREATE_CLIENT_MUTATION = `
  mutation CreateClient($input: CreateClientInput!) {
    createClient(input: $input) {
      id
      fullName
      addressLine1
      addressLine2
      city
      postcode
    }
  }
`;

interface FormData {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyNoticeAcknowledged, setPrivacyNoticeAcknowledged] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedData = {
      fullName: formData.fullName.trim(),
      addressLine1: formData.addressLine1.trim(),
      addressLine2: formData.addressLine2.trim(),
      city: formData.city.trim(),
      postcode: formData.postcode.trim().toUpperCase(),
    };

    const isMissingRequiredField = !trimmedData.fullName ||
      !trimmedData.addressLine1 ||
      !trimmedData.city ||
      !trimmedData.postcode;

    if (isMissingRequiredField) {
      setError('Please complete all required fields before creating the client.');
      return;
    }

    if (!privacyNoticeAcknowledged) {
      setError('You must confirm the privacy notice and lawful basis acknowledgement to continue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await clientQuery(CREATE_CLIENT_MUTATION, {
        input: {
          fullName: trimmedData.fullName,
          addressLine1: trimmedData.addressLine1,
          addressLine2: trimmedData.addressLine2 || null,
          city: trimmedData.city,
          postcode: trimmedData.postcode,
          privacyNoticeAcknowledged: true,
          privacyNoticeVersion: 'pilot-v1',
        },
      });

      setFormData({
        fullName: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        postcode: '',
      });
      setPrivacyNoticeAcknowledged(false);
      router.push('/clients');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    Boolean(
      formData.fullName.trim() &&
      formData.addressLine1.trim() &&
      formData.city.trim() &&
      formData.postcode.trim()
    ) &&
    privacyNoticeAcknowledged &&
    !isSubmitting;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2">
              <li>
                <Link href="/clients" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Clients
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="h-5 w-5 flex-shrink-0 text-slate-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-2 text-sm font-medium text-slate-900">Add New Client</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900 font-heading">
            Add New Client
          </h1>
          <p className="text-slate-500 mt-1">
            Register a new client for care services
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-slate-900 font-heading">
              Client Information
            </h2>
            <p className="text-sm text-slate-500">
              Please provide the client&apos;s details below
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g., Margaret Thompson"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Address Line 1 */}
              <div>
                <label htmlFor="addressLine1" className="block text-sm font-medium text-slate-700 mb-1">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="addressLine1"
                  name="addressLine1"
                  required
                  value={formData.addressLine1}
                  onChange={handleChange}
                  placeholder="e.g., 15 Oak Street"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Address Line 2 */}
              <div>
                <label htmlFor="addressLine2" className="block text-sm font-medium text-slate-700 mb-1">
                  Address Line 2 <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  id="addressLine2"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  placeholder="e.g., Flat 2B"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* City and Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g., London"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label htmlFor="postcode" className="block text-sm font-medium text-slate-700 mb-1">
                    Postcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="postcode"
                    name="postcode"
                    required
                    value={formData.postcode}
                    onChange={handleChange}
                    placeholder="e.g., SW1A 1AA"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 uppercase"
                  />
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-800 mb-1">
                      Privacy notice and lawful basis check
                    </h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Client records in Oasis are created for care delivery and operational oversight. Before
                      creating a record, confirm that the privacy notice has been provided, or that your
                      organisation has arranged for it to be provided under the relevant lawful basis for care.
                    </p>
                    <p className="text-xs text-blue-700 mb-3">
                      Read the{' '}
                      <Link href="/privacy" className="font-medium underline underline-offset-2">
                        privacy notice
                      </Link>{' '}
                      and{' '}
                      <Link href="/data-processing" className="font-medium underline underline-offset-2">
                        data processing summary
                      </Link>
                      .
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacyNoticeAcknowledged}
                        onChange={(e) => setPrivacyNoticeAcknowledged(e.target.checked)}
                        className="mt-1 h-4 w-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-blue-800">
                        I confirm that the privacy information has been provided, or arranged to be provided,
                        and that I am creating this record under the organisation&apos;s lawful basis for care
                        delivery.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Link href="/clients" className={buttonVariants({ variant: 'ghost' })}>
                  Cancel
                </Link>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={!canSubmit}
                >
                  {isSubmitting ? 'Creating...' : 'Create Client'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
