'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '../../components/oasis/Header';
import { useClientAccess } from '../../components/providers/ClientAccessProvider';
import { clientQuery } from '../../lib/graphql/client-side';
import {
  formatDate as formatOrganizationDate,
  formatTime as formatOrganizationTime,
} from '../../lib/time';

interface MedicationAdministration {
  id: string;
  scheduledTime: string;
  administeredTime?: string;
  status: 'SCHEDULED' | 'ADMINISTERED' | 'MISSED' | 'REFUSED' | 'CANCELLED';
  notes?: string;
  prescription: {
    specialInstructions?: string;
    client: {
      id: string;
      fullName: string;
    };
    medication: {
      id: string;
      name: string;
      dosage: string;
      unit: string;
    };
  };
  visit?: {
    scheduledStart: string;
    scheduledEnd: string;
  };
}

interface ClientOption {
  id: string;
  fullName: string;
}

interface MedicationOption {
  id: string;
  name: string;
  dosage: string;
  unit: string;
  instructions?: string;
}

interface GetTodaysMedicationsResponse {
  getTodaysMedicationsByClient: MedicationAdministration[];
}

interface ClientsResponse {
  clients: {
    items: ClientOption[];
  };
}

interface MedicationsResponse {
  medications: {
    items: MedicationOption[];
  };
}

const EMAR_QUERY = `
  query GetTodaysMedications($date: String!) {
    getTodaysMedicationsByClient(date: $date) {
      id
      scheduledTime
      administeredTime
      status
      notes
      prescription {
        specialInstructions
        client { id fullName }
        medication { id name dosage unit }
      }
      visit { scheduledStart scheduledEnd }
    }
  }
`;

const CLIENTS_QUERY = `
  query ClientsForEmar {
    clients(skip: 0, take: 100) {
      items {
        id
        fullName
      }
    }
  }
`;

const MEDICATIONS_QUERY = `
  query MedicationsForEmar {
    medications(skip: 0, take: 100) {
      items {
        id
        name
        dosage
        unit
        instructions
      }
    }
  }
`;

const CREATE_MEDICATION_MUTATION = `
  mutation CreateMedication($input: CreateMedicationInput!) {
    createMedication(input: $input) {
      id
      name
      dosage
      unit
    }
  }
`;

const CREATE_PRESCRIPTION_MUTATION = `
  mutation CreatePrescription($input: CreatePrescriptionInput!) {
    createPrescription(input: $input) {
      id
      clientId
      medicationId
      administrationTimes
      startDate
      endDate
    }
  }
`;

function EmarPageContent() {
  const searchParams = useSearchParams();
  const clientFilterId = searchParams.get('clientId') || '';
  const {
    authenticated,
    getBearerToken,
    isAdmin,
    isStaff,
    status: authStatus,
  } = useClientAccess();

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(true);
  const [medicationsError, setMedicationsError] = useState<string | null>(null);
  const [medications, setMedications] = useState<MedicationAdministration[]>([]);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [medicationOptions, setMedicationOptions] = useState<MedicationOption[]>([]);
  const [provisioningMessage, setProvisioningMessage] = useState<string | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [provisioningLoading, setProvisioningLoading] = useState(false);

  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    unit: '',
    instructions: '',
  });

  const [newPrescription, setNewPrescription] = useState({
    clientId: clientFilterId,
    medicationId: '',
    startDate: selectedDate,
    endDate: '',
    frequencyPerDay: '1',
    administrationTimes: '08:00',
    specialInstructions: '',
  });

  const fetchMedications = useCallback(async () => {
    if (authStatus === 'loading') return;

    setLoading(true);
    setMedicationsError(null);

    if (!authenticated) {
      setMedicationsError('Unauthorized');
      setMedications([]);
      setLoading(false);
      return;
    }

    if (!isStaff) {
      setMedicationsError('Forbidden');
      setMedications([]);
      setLoading(false);
      return;
    }

    try {
      const data = await clientQuery<GetTodaysMedicationsResponse>(
        EMAR_QUERY,
        { date: selectedDate },
        { getBearerToken },
      );
      setMedications(data.getTodaysMedicationsByClient || []);
    } catch (err) {
      console.error('Failed to fetch medications:', err);
      setMedicationsError(err instanceof Error ? err.message : 'Failed to load medications');
      setMedications([]);
    } finally {
      setLoading(false);
    }
  }, [authenticated, authStatus, getBearerToken, isStaff, selectedDate]);

  const fetchProvisioningData = useCallback(async () => {
    if (authStatus === 'loading' || !authenticated || !isAdmin) return;
    setProvisioningError(null);
    try {
      const [clientsData, medsData] = await Promise.all([
        clientQuery<ClientsResponse>(CLIENTS_QUERY, undefined, { getBearerToken }),
        clientQuery<MedicationsResponse>(MEDICATIONS_QUERY, undefined, { getBearerToken }),
      ]);
      setClients(clientsData.clients.items || []);
      setMedicationOptions(medsData.medications.items || []);
    } catch (err) {
      console.error('Failed to load provisioning options:', err);
      setClients([]);
      setMedicationOptions([]);
      setProvisioningError(err instanceof Error ? err.message : 'Failed to load provisioning options');
    }
  }, [authenticated, authStatus, getBearerToken, isAdmin]);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  useEffect(() => {
    fetchProvisioningData();
  }, [fetchProvisioningData]);

  useEffect(() => {
    if (clientFilterId) {
      setNewPrescription((prev) => ({ ...prev, clientId: clientFilterId }));
    }
  }, [clientFilterId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-yellow-100 text-yellow-800';
      case 'ADMINISTERED':
        return 'bg-green-100 text-green-800';
      case 'MISSED':
        return 'bg-red-100 text-red-800';
      case 'REFUSED':
        return 'bg-orange-100 text-orange-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string) => {
    return formatOrganizationTime(dateString);
  };

  const formatDate = (dateString: string) => {
    return formatOrganizationDate(dateString, {
      weekday: 'short',
    });
  };

  const filteredMedications = useMemo(
    () =>
      medications.filter(
        (med) => !clientFilterId || med.prescription.client.id === clientFilterId,
      ),
    [clientFilterId, medications],
  );

  const groupedByClient = useMemo(
    () =>
      filteredMedications.reduce((acc, med) => {
        const clientName = med.prescription.client.fullName;
        if (!acc[clientName]) {
          acc[clientName] = [];
        }
        acc[clientName].push(med);
        return acc;
      }, {} as Record<string, MedicationAdministration[]>),
    [filteredMedications],
  );

  const isUnauthorized =
    !!medicationsError &&
    (medicationsError.includes('401') || medicationsError.toLowerCase().includes('unauthorized'));

  const refetch = () => {
    fetchMedications();
  };

  const handleCreateMedication = async () => {
    if (!isAdmin) return;
    if (!newMedication.name.trim() || !newMedication.dosage.trim() || !newMedication.unit.trim()) {
      setProvisioningMessage('Medication name, dosage, and unit are required.');
      return;
    }

    setProvisioningLoading(true);
    setProvisioningMessage(null);
    try {
      await clientQuery(
        CREATE_MEDICATION_MUTATION,
        {
          input: {
            name: newMedication.name.trim(),
            dosage: newMedication.dosage.trim(),
            unit: newMedication.unit.trim(),
            instructions: newMedication.instructions.trim() || null,
          },
        },
        { getBearerToken },
      );
      setNewMedication({ name: '', dosage: '', unit: '', instructions: '' });
      setProvisioningMessage('Medication created.');
      await fetchProvisioningData();
    } catch (err: any) {
      setProvisioningMessage(err?.message || 'Failed to create medication');
    } finally {
      setProvisioningLoading(false);
    }
  };

  const handleCreatePrescription = async () => {
    if (!isAdmin) return;
    if (!newPrescription.clientId || !newPrescription.medicationId || !newPrescription.startDate) {
      setProvisioningMessage('Client, medication, and start date are required.');
      return;
    }

    const times = newPrescription.administrationTimes
      .split(',')
      .map((time) => time.trim())
      .filter(Boolean);

    if (!times.length) {
      setProvisioningMessage('At least one administration time is required (HH:mm).');
      return;
    }

    setProvisioningLoading(true);
    setProvisioningMessage(null);
    try {
      await clientQuery(
        CREATE_PRESCRIPTION_MUTATION,
        {
          input: {
            clientId: newPrescription.clientId,
            medicationId: newPrescription.medicationId,
            startDate: `${newPrescription.startDate}T00:00:00.000Z`,
            endDate: newPrescription.endDate
              ? `${newPrescription.endDate}T23:59:59.999Z`
              : null,
            frequencyPerDay: Number(newPrescription.frequencyPerDay || '1'),
            administrationTimes: times,
            specialInstructions: newPrescription.specialInstructions.trim() || null,
            isActive: true,
          },
        },
        { getBearerToken },
      );

      setProvisioningMessage('Prescription created and schedule materialized.');
      await fetchMedications();
    } catch (err: any) {
      setProvisioningMessage(err?.message || 'Failed to create prescription');
    } finally {
      setProvisioningLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-4 w-1/3"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-300 rounded mb-2 w-1/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Electronic Medication Administration Record (eMAR)
          </h1>
          <p className="text-slate-500 mt-1">Track and manage medication administration</p>
        </div>

        {isAdmin && (
          <section className="mb-8 bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Admin Provisioning</h2>
            {provisioningError && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Provisioning data could not be loaded.</p>
                <p className="mt-1">{provisioningError}</p>
                <button
                  type="button"
                  onClick={fetchProvisioningData}
                  className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-white hover:bg-amber-700"
                >
                  Retry provisioning load
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-3">Create Medication</h3>
                <div className="space-y-3">
                  <input
                    value={newMedication.name}
                    onChange={(e) => setNewMedication((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Medication name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication((p) => ({ ...p, dosage: e.target.value }))}
                      placeholder="Dosage"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      value={newMedication.unit}
                      onChange={(e) => setNewMedication((p) => ({ ...p, unit: e.target.value }))}
                      placeholder="Unit"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <input
                    value={newMedication.instructions}
                    onChange={(e) =>
                      setNewMedication((p) => ({ ...p, instructions: e.target.value }))
                    }
                    placeholder="Instructions (optional)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={provisioningLoading}
                    onClick={handleCreateMedication}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50"
                  >
                    {provisioningLoading ? 'Saving...' : 'Create Medication'}
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-3">Create Prescription</h3>
                <div className="space-y-3">
                  <select
                    value={newPrescription.clientId}
                    onChange={(e) =>
                      setNewPrescription((p) => ({ ...p, clientId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.fullName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newPrescription.medicationId}
                    onChange={(e) =>
                      setNewPrescription((p) => ({ ...p, medicationId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select medication</option>
                    {medicationOptions.map((med) => (
                      <option key={med.id} value={med.id}>
                        {med.name} ({med.dosage} {med.unit})
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={newPrescription.startDate}
                      onChange={(e) =>
                        setNewPrescription((p) => ({ ...p, startDate: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="date"
                      value={newPrescription.endDate}
                      onChange={(e) =>
                        setNewPrescription((p) => ({ ...p, endDate: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={newPrescription.frequencyPerDay}
                      onChange={(e) =>
                        setNewPrescription((p) => ({ ...p, frequencyPerDay: e.target.value }))
                      }
                      placeholder="Frequency/day"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                      value={newPrescription.administrationTimes}
                      onChange={(e) =>
                        setNewPrescription((p) => ({
                          ...p,
                          administrationTimes: e.target.value,
                        }))
                      }
                      placeholder="Times (e.g. 08:00,20:00)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <input
                    value={newPrescription.specialInstructions}
                    onChange={(e) =>
                      setNewPrescription((p) => ({
                        ...p,
                        specialInstructions: e.target.value,
                      }))
                    }
                    placeholder="Special instructions (optional)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />

                  <button
                    type="button"
                    disabled={provisioningLoading}
                    onClick={handleCreatePrescription}
                    className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {provisioningLoading ? 'Saving...' : 'Create Prescription'}
                  </button>
                </div>
              </div>
            </div>
            {provisioningMessage && (
              <p className="text-sm text-slate-700 mt-4">{provisioningMessage}</p>
            )}
          </section>
        )}

        <div className="mb-6">
          {medicationsError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Medications</h2>
              <p className="text-red-600">{medicationsError}</p>
              {isUnauthorized ? (
                <Link
                  href="/login"
                  className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Sign in
                </Link>
              ) : (
                <button
                  onClick={refetch}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
          <div className="flex items-center space-x-4 flex-wrap gap-y-3">
            <label htmlFor="date" className="text-sm font-medium text-slate-700">
              Date:
            </label>
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="text-sm text-slate-600">
              {filteredMedications.length} medication
              {filteredMedications.length !== 1 ? 's' : ''} scheduled
            </div>
            {clientFilterId && (
              <div className="text-xs text-slate-500">
                Filtered to client ID: <span className="font-mono">{clientFilterId}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {['SCHEDULED', 'ADMINISTERED', 'MISSED', 'REFUSED', 'CANCELLED'].map((status) => {
            const count = filteredMedications.filter((med) => med.status === status).length;
            return (
              <div key={status} className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className={`text-sm font-medium capitalize ${getStatusColor(status).split(' ')[1]}`}>
                  {status.toLowerCase()}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          {Object.keys(groupedByClient).length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <p className="text-gray-500 text-lg">
                No medications scheduled for {formatDate(selectedDate)}
              </p>
            </div>
          ) : (
            Object.entries(groupedByClient).map(([clientName, clientMeds]) => (
              <div key={clientName} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">{clientName}</h2>
                  <p className="text-sm text-gray-600">
                    {clientMeds.length} medication{clientMeds.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Administered</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clientMeds.map((med) => (
                        <tr key={med.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatTime(med.scheduledTime)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {med.prescription.medication.name}
                            </div>
                            {med.prescription.specialInstructions && (
                              <div className="text-xs text-gray-500 mt-1">
                                {med.prescription.specialInstructions}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {med.prescription.medication.dosage} {med.prescription.medication.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(med.status)}`}>
                              {med.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {med.administeredTime ? formatTime(med.administeredTime) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {med.visit ? (
                              <div>
                                <div>
                                  {formatTime(med.visit.scheduledStart)} - {formatTime(med.visit.scheduledEnd)}
                                </div>
                              </div>
                            ) : (
                              'No visit'
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {med.notes ? (
                              <div className="max-w-xs truncate" title={med.notes}>
                                {med.notes}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default function EmarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded mb-4 w-1/3"></div>
            </div>
          </div>
        </div>
      }
    >
      <EmarPageContent />
    </Suspense>
  );
}
