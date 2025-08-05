'use client';

import { useState, useEffect } from 'react';
import { fetcher } from '../../lib/api';

interface MedicationAdministration {
  id: string;
  scheduledTime: string;
  administeredTime?: string;
  status: 'SCHEDULED' | 'ADMINISTERED' | 'MISSED' | 'REFUSED' | 'CANCELLED';
  notes?: string;
  prescription: {
    id: string;
    medication: {
      name: string;
      dosage: string;
      unit: string;
    };
    client: {
      fullName: string;
    };
    administrationTimes: string[];
    specialInstructions?: string;
  };
  visit?: {
    id: string;
    scheduledStart: string;
    scheduledEnd: string;
  };
}

export default function EmarPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demonstration
  const medications: MedicationAdministration[] = [
    {
      id: '1',
      scheduledTime: '2025-01-08T08:00',
      status: 'SCHEDULED',
      prescription: {
        id: 'p1',
        medication: {
          name: 'Metformin',
          dosage: '500',
          unit: 'mg'
        },
        client: {
          fullName: 'John Smith'
        },
        administrationTimes: ['08:00', '20:00'],
        specialInstructions: 'Take with food'
      },
      visit: {
        id: 'v1',
        scheduledStart: '2025-01-08T07:30',
        scheduledEnd: '2025-01-08T08:30'
      }
    },
    {
      id: '2',
      scheduledTime: '2025-01-08T09:00',
      administeredTime: '2025-01-08T09:05',
      status: 'ADMINISTERED',
      notes: 'Patient took medication without issues',
      prescription: {
        id: 'p2',
        medication: {
          name: 'Lisinopril',
          dosage: '10',
          unit: 'mg'
        },
        client: {
          fullName: 'Jane Doe'
        },
        administrationTimes: ['09:00'],
      },
      visit: {
        id: 'v2',
        scheduledStart: '2025-01-08T08:45',
        scheduledEnd: '2025-01-08T09:15'
      }
    },
    {
      id: '3',
      scheduledTime: '2025-01-08T12:00',
      status: 'MISSED',
      notes: 'Patient was sleeping, will attempt later',
      prescription: {
        id: 'p3',
        medication: {
          name: 'Warfarin',
          dosage: '5',
          unit: 'mg'
        },
        client: {
          fullName: 'Bob Johnson'
        },
        administrationTimes: ['12:00'],
        specialInstructions: 'Monitor INR levels'
      }
    }
  ];

  const refetch = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

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
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const groupedByClient = medications.reduce((acc, med) => {
    const clientName = med.prescription.client.fullName;
    if (!acc[clientName]) {
      acc[clientName] = [];
    }
    acc[clientName].push(med);
    return acc;
  }, {} as Record<string, MedicationAdministration[]>);

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Medications</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Electronic Medication Administration Record (eMAR)</h1>
          
          <div className="flex items-center space-x-4">
            <label htmlFor="date" className="text-sm font-medium text-gray-700">
              Date:
            </label>
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-sm text-gray-600">
              {medications.length} medication{medications.length !== 1 ? 's' : ''} scheduled
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {['SCHEDULED', 'ADMINISTERED', 'MISSED', 'REFUSED', 'CANCELLED'].map((status) => {
            const count = medications.filter((med) => med.status === status).length;
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

        {/* Medications by Client */}
        <div className="space-y-6">
          {Object.keys(groupedByClient).length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <p className="text-gray-500 text-lg">No medications scheduled for {formatDate(selectedDate)}</p>
            </div>
          ) : (
            Object.entries(groupedByClient).map(([clientName, clientMeds]) => (
              <div key={clientName} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">{clientName}</h2>
                  <p className="text-sm text-gray-600">{clientMeds.length} medication{clientMeds.length !== 1 ? 's' : ''}</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medication
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dosage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Administered
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Visit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clientMeds.map((med) => (
                        <tr key={med.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatTime(med.scheduledTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{med.prescription.medication.name}</div>
                            {med.prescription.specialInstructions && (
                              <div className="text-xs text-gray-500 mt-1">{med.prescription.specialInstructions}</div>
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
                                <div>{formatTime(med.visit.scheduledStart)} - {formatTime(med.visit.scheduledEnd)}</div>
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
      </div>
    </div>
  );
}
