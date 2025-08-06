describe('AI Summary Flow', () => {
  beforeEach(() => {
    // Mock authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', 'mock-token');
      win.localStorage.setItem('user-role', 'manager');
    });
  });

  it('should complete the full AI summary approval workflow', () => {
    const clientId = 'test-client-1';
    
    // Seed test data - this would normally be done via fixtures
    cy.intercept('POST', '/graphql', (req) => {
      if (req.body.query?.includes('currentWeekSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              currentWeekSummary: null
            }
          }
        });
      }
      
      if (req.body.query?.includes('generateSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              generateSummary: {
                id: 'generated-summary-1',
                clientId: clientId,
                periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                periodEnd: new Date().toISOString(),
                summaryJson: {
                  overall_health: "Client shows stable health with monitoring needed",
                  key_observations: [
                    "Medication compliance excellent",
                    "Mobility improvements noted",
                    "Sleep patterns regular"
                  ],
                  recommendations: [
                    "Continue current care plan",
                    "Monitor blood pressure weekly",
                    "Increase social activities"
                  ],
                  visit_summary: {
                    total_visits: 12,
                    completed_visits: 12,
                    missed_visits: 0,
                    average_visit_duration: "40 minutes"
                  }
                },
                riskLevels: {
                  overall: "green",
                  mobility: "green",
                  medication: "green",
                  mental_health: "amber",
                  nutrition: "green",
                  safety: "green"
                },
                generatedAt: new Date().toISOString(),
                generatedBy: "ai",
                status: "PENDING",
                approvedBy: null,
                approvedAt: null,
                feedback: null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                client: {
                  id: clientId,
                  fullName: "Test Client",
                  addressLine1: "123 Test St",
                  city: "Test City",
                  postcode: "T1 2ST"
                }
              }
            }
          }
        });
      }
      
      if (req.body.query?.includes('approveSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              approveSummary: {
                id: 'generated-summary-1',
                status: 'APPROVED',
                approvedBy: 'manager-user-id',
                approvedAt: new Date().toISOString(),
                feedback: 'approved'
              }
            }
          }
        });
      }
    }).as('graphqlRequest');

    // Visit the AI summary page
    cy.visit(`/clients/${clientId}/summary`);

    // Verify page loads and shows "no summary" state initially
    cy.contains('AI Health Summary').should('be.visible');
    cy.contains('No Health Summary Available').should('be.visible');

    // Generate a new summary
    cy.contains('Generate Summary').click();
    cy.contains('Generating Summary...').should('be.visible');

    // Wait for generation to complete
    cy.wait('@graphqlRequest');
    cy.contains('Generating Summary...').should('not.exist');

    // Verify summary is displayed
    cy.contains('Health Summary').should('be.visible');
    cy.contains('Test Client').should('be.visible');
    cy.contains('Client shows stable health with monitoring needed').should('be.visible');

    // Verify risk indicators are shown
    cy.get('[data-testid="risk-indicator"]').should('have.length.greaterThan', 3);
    cy.contains('Overall: green').should('be.visible');

    // Verify key observations are displayed
    cy.contains('Key Observations').should('be.visible');
    cy.contains('Medication compliance excellent').should('be.visible');

    // Verify recommendations are displayed
    cy.contains('Recommendations').should('be.visible');
    cy.contains('Continue current care plan').should('be.visible');

    // Verify visit summary stats
    cy.contains('Visit Summary').should('be.visible');
    cy.contains('12').should('be.visible'); // total visits
    cy.contains('40 minutes').should('be.visible'); // average duration

    // Verify approval controls are shown for manager role
    cy.contains('PENDING APPROVAL').should('be.visible');
    cy.contains('This health summary requires manager approval').should('be.visible');

    // Approve the summary
    cy.contains('Approve').click();
    cy.wait('@graphqlRequest');

    // Verify approval status updated
    cy.contains('APPROVED').should('be.visible');
    cy.contains('PENDING APPROVAL').should('not.exist');

    // Verify export functionality is available
    cy.contains('Export PDF').should('be.visible').and('not.be.disabled');

    // Test export functionality
    cy.contains('Export PDF').click();
    cy.contains('Exporting...').should('be.visible');

    // Wait for export to complete (mocked delay)
    cy.contains('Exporting...', { timeout: 3000 }).should('not.exist');
  });

  it('should handle rejection workflow', () => {
    const clientId = 'test-client-2';
    
    // Mock a pending summary
    cy.intercept('POST', '/graphql', (req) => {
      if (req.body.query?.includes('currentWeekSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              currentWeekSummary: {
                id: 'pending-summary-1',
                clientId: clientId,
                periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                periodEnd: new Date().toISOString(),
                summaryJson: {
                  overall_health: "Summary requires review",
                  key_observations: ["Needs attention"],
                  recommendations: ["Review care plan"]
                },
                riskLevels: { overall: "red" },
                generatedAt: new Date().toISOString(),
                generatedBy: "ai",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                client: {
                  id: clientId,
                  fullName: "Test Client 2",
                  city: "Test City"
                }
              }
            }
          }
        });
      }
      
      if (req.body.query?.includes('approveSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              approveSummary: {
                id: 'pending-summary-1',
                status: 'REJECTED',
                approvedBy: 'manager-user-id',
                approvedAt: new Date().toISOString(),
                feedback: 'Summary needs more detailed observations'
              }
            }
          }
        });
      }
    }).as('graphqlRequest');

    cy.visit(`/clients/${clientId}/summary`);

    // Wait for summary to load
    cy.wait('@graphqlRequest');
    cy.contains('PENDING APPROVAL').should('be.visible');

    // Reject the summary
    cy.contains('Reject').click();

    // Modal should appear for feedback
    cy.contains('Reject Summary').should('be.visible');
    cy.contains('Please provide feedback').should('be.visible');

    // Enter rejection feedback
    cy.get('textarea[placeholder*="Reason for rejection"]')
      .type('Summary needs more detailed observations');

    // Submit rejection
    cy.contains('Reject Summary').click();
    cy.wait('@graphqlRequest');

    // Verify rejection status
    cy.contains('REJECTED').should('be.visible');
    cy.contains('Summary needs more detailed observations').should('be.visible');
  });

  it('should handle carer role permissions correctly', () => {
    const clientId = 'test-client-3';
    
    // Set carer role
    cy.window().then((win) => {
      win.localStorage.setItem('user-role', 'carer');
    });

    // Mock an approved summary
    cy.intercept('POST', '/graphql', (req) => {
      if (req.body.query?.includes('currentWeekSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              currentWeekSummary: {
                id: 'approved-summary-1',
                clientId: clientId,
                periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                periodEnd: new Date().toISOString(),
                summaryJson: {
                  overall_health: "Client in good health",
                  key_observations: ["Stable condition"],
                  recommendations: ["Continue plan"]
                },
                riskLevels: { overall: "green" },
                generatedAt: new Date().toISOString(),
                generatedBy: "ai",
                status: "APPROVED",
                approvedBy: "manager-id",
                approvedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                client: {
                  id: clientId,
                  fullName: "Test Client 3",
                  city: "Test City"
                }
              }
            }
          }
        });
      }
    }).as('graphqlRequest');

    cy.visit(`/clients/${clientId}/summary`);
    cy.wait('@graphqlRequest');

    // Verify carer can see summary but not approval controls
    cy.contains('Health Summary').should('be.visible');
    cy.contains('APPROVED').should('be.visible');
    
    // Approval buttons should not be visible for carer
    cy.contains('Approve').should('not.exist');
    cy.contains('Reject').should('not.exist');
    cy.contains('PENDING APPROVAL').should('not.exist');

    // Export should still be available
    cy.contains('Export PDF').should('be.visible');
  });

  it('should handle AI disabled organization', () => {
    const clientId = 'test-client-4';
    
    // Mock AI disabled response
    cy.intercept('GET', '**/organizations/*/ai-status', {
      statusCode: 200,
      body: { aiEnabled: false }
    }).as('aiStatus');

    cy.visit(`/clients/${clientId}/summary`);

    // Should show AI not available message
    cy.contains('AI Health Summaries Not Available').should('be.visible');
    cy.contains('AI-powered health summaries are not enabled').should('be.visible');
    cy.contains('Contact your administrator').should('be.visible');

    // Generate button should not be present
    cy.contains('Generate Summary').should('not.exist');
  });

  it('should handle expired summaries correctly', () => {
    const clientId = 'test-client-5';
    
    // Mock expired summary
    cy.intercept('POST', '/graphql', (req) => {
      if (req.body.query?.includes('currentWeekSummary')) {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              currentWeekSummary: {
                id: 'expired-summary-1',
                clientId: clientId,
                periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                periodEnd: new Date().toISOString(),
                summaryJson: {
                  overall_health: "Expired summary",
                  key_observations: ["Old data"],
                  recommendations: ["Review needed"]
                },
                riskLevels: { overall: "amber" },
                generatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                generatedBy: "ai",
                status: "PENDING",
                expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Expired 2 hours ago
                client: {
                  id: clientId,
                  fullName: "Test Client 5",
                  city: "Test City"
                }
              }
            }
          }
        });
      }
    }).as('graphqlRequest');

    cy.visit(`/clients/${clientId}/summary`);
    cy.wait('@graphqlRequest');

    // Should show expired indicator
    cy.contains('Expired').should('be.visible');
    
    // Summary should still be visible but marked as expired
    cy.contains('Health Summary').should('be.visible');
    cy.contains('Expired summary').should('be.visible');
  });
});
