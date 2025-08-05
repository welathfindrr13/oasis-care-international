'use client';

import { useState, useEffect } from 'react';
import { fetcher } from '../lib/api';

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
}

interface MedsTabProps {
  visitId: string;
  userId: string;
  userRole: string;
}

export default function MedsTab({ visitId, userId, userRole }: MedsTabProps) {
  const [medications, setMedications] = useState<MedicationAdministration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Mock data for demonstration
  const mockMedications: MedicationAdministration[] = [
    {
      id: '1',
      scheduledTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
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
      }
    },
    {
      id: '2',
      scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      status: 'SCHEDULED',
      prescription: {
        id: 'p2',
        medication: {
          name: 'Lisinopril',
          dosage: '10',
          unit: 'mg'
        },
        client: {
          fullName: 'John Smith'
        },
        administrationTimes: ['12:00'],
        specialInstructions: 'Monitor blood pressure'
      }
    }
  ];

  useEffect(() => {
    fetchDueMedications();
  }, [visitId]);

  const fetchDueMedications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock API call - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMedications(mockMedications);
    } catch (err) {
      setError('Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  const recordAdministration = async (
    administrationId: string, 
    status: 'ADMINISTERED' | 'MISSED' | 'REFUSED' | 'CANCELLED',
    notes?: string
  ) => {
    try {
      setProcessingIds(prev => new Set(prev).add(administrationId));
      
      // Mock API call - replace with actual GraphQL mutation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update local state
      setMedications(prev => prev.map(med => 
        med.id === administrationId 
          ? { 
              ...med, 
              status, 
              administeredTime: status === 'ADMINISTERED' ? new Date().toISOString() : undefined,
              notes: notes || med.notes
            }
          : med
      ));
    } catch (err) {
      setError(`Failed to record ${status.toLowerCase()}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(administrationId);
        return newSet;
      });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ADMINISTERED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'MISSED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'REFUSED':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTimeUntilDue = (scheduledTime: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 0) {
      return `${Math.abs(diffMins)} min overdue`;
    } else if (diffMins < 60) {
      return `Due in ${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      return `Due in ${hours}h ${diffMins % 60}m`;
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 bg-gray-300 rounded w-32"></div>
            <div className="h-6 bg-gray-300 rounded w-16"></div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="space-y-3">
                <div className="h-5 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                <div className="h-4 bg-gray-300 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDueMedications}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Medications</h2>
        <button
          onClick={fetchDueMedications}
          className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Medications List */}
      <div className="space-y-4">
        {medications.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No medications due for this visit</p>
          </div>
        ) : (
          medications.map((med) => (
            <div key={med.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
              {/* Medication Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {med.prescription.medication.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {med.prescription.medication.dosage} {med.prescription.medication.unit}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(med.status)}`}>
                    {med.status.toLowerCase()}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Scheduled: {formatTime(med.scheduledTime)}</span>
                  </div>
                  
                  {med.status === 'SCHEDULED' && (
                    <div className="flex items-center text-sm text-orange-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span>{getTimeUntilDue(med.scheduledTime)}</span>
                    </div>
                  )}

                  {med.administeredTime && (
                    <div className="flex items-center text-sm text-green-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Given: {formatTime(med.administeredTime)}</span>
                    </div>
                  )}

                  {med.prescription.specialInstructions && (
                    <div className="bg-blue-50 p-2 rounded text-sm text-blue-800">
                      <strong>Instructions:</strong> {med.prescription.specialInstructions}
                    </div>
                  )}

                  {med.notes && (
                    <div className="bg-gray-50 p-2 rounded text-sm text-gray-700">
                      <strong>Notes:</strong> {med.notes}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {med.status === 'SCHEDULED' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => recordAdministration(med.id, 'ADMINISTERED')}
                      disabled={processingIds.has(med.id)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {processingIds.has(med.id) ? (
                        <div className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </div>
                      ) : (
                        'Mark Given'
                      )}
                    </button>
                    
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const status = e.target.value as 'MISSED' | 'REFUSED' | 'CANCELLED';
                          if (status) {
                            recordAdministration(med.id, status);
                          }
                        }}
                        disabled={processingIds.has(med.id)}
                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium appearance-none"
                      >
                        <option value="">Mark as...</option>
                        <option value="MISSED">Missed</option>
                        <option value="REFUSED">Refused</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
