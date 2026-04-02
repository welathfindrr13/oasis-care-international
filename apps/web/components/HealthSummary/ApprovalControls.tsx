'use client';

import { useState } from 'react';

interface ApprovalControlsProps {
  summaryId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  feedback?: string;
  userRole: string;
  onApprove: (summaryId: string, feedback?: string) => Promise<void>;
  className?: string;
}

export default function ApprovalControls({
  summaryId,
  status,
  approvedBy,
  approvedAt,
  feedback,
  userRole,
  onApprove,
  className = ''
}: ApprovalControlsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedAction, setSelectedAction] = useState<'approved' | 'rejected' | null>(null);

  // Only show controls to admins in the current release flow.
  if (userRole !== 'admin') {
    return null;
  }

  // Don't show controls if already processed
  if (status !== 'PENDING') {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className={`
            inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
            ${status === 'APPROVED' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
            }
          `}>
            {status === 'APPROVED' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {status}
          </div>
          
          <div className="text-sm text-gray-600">
            {approvedBy && approvedAt && (
              <>
                by {approvedBy} on {new Date(approvedAt).toLocaleDateString()}
              </>
            )}
          </div>
        </div>
        
        {feedback && feedback !== 'approved' && (
          <div className="mt-3 p-3 bg-gray-100 rounded text-sm">
            <strong>Feedback:</strong> {feedback}
          </div>
        )}
      </div>
    );
  }

  const handleApproval = async (action: 'approved' | 'rejected') => {
    if (action === 'rejected') {
      setSelectedAction(action);
      setShowFeedbackModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      await onApprove(summaryId, action);
    } catch (error) {
      console.error('Failed to approve summary:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!selectedAction) return;

    setIsProcessing(true);
    try {
      await onApprove(summaryId, selectedAction === 'rejected' ? feedbackText || 'rejected' : selectedAction);
      setShowFeedbackModal(false);
      setFeedbackText('');
      setSelectedAction(null);
    } catch (error) {
      console.error('Failed to process summary:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            PENDING APPROVAL
          </div>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          This health summary requires admin approval before it can be treated as staff-reviewed context.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleApproval('approved')}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Approve
          </button>

          <button
            onClick={() => handleApproval('rejected')}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            Reject
          </button>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Summary
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Please provide feedback for rejecting this health summary:
            </p>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Reason for rejection..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleFeedbackSubmit}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Reject Summary'}
              </button>
              
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText('');
                  setSelectedAction(null);
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
