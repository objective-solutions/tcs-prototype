// Constants
const STANDARD_SESSION_PACKAGE = 12;

// Audit log to track all session-related activities
class AuditLog {
    constructor() {
        this.logs = [];
    }

    addEntry(action, details) {
        const entry = {
            timestamp: new Date(),
            action,
            details,
            id: Date.now().toString()
        };
        this.logs.unshift(entry);
        return entry;
    }
}

// Organization class with enhanced session management
class Organization {
    constructor(name, totalSessions, type) {
        this.id = Date.now().toString();
        this.name = name;
        this.totalSessions = totalSessions;
        this.type = type; // 'purchaser' or 'referrer'
        this.reservedSessions = 0;
        this.usedSessions = 0;
        this.active = true;
        this.createdAt = new Date();
    }

    get remainingSessions() {
        return this.totalSessions - this.reservedSessions;
    }

    canReserveSession(count = STANDARD_SESSION_PACKAGE) {
        return this.type === 'purchaser' && this.remainingSessions >= count;
    }

    reserveSessions(count = STANDARD_SESSION_PACKAGE) {
        if (!this.canReserveSession(count)) {
            throw new Error(`Unable to reserve ${count} sessions for ${this.name}. Available: ${this.remainingSessions}`);
        }
        this.reservedSessions += count;
        return true;
    }

    releaseUnusedSessions(count) {
        if (count > this.reservedSessions - this.usedSessions) {
            throw new Error('Cannot release more sessions than are reserved and unused');
        }
        this.reservedSessions -= count;
        return true;
    }
}

// Session Management System
class SessionManagementSystem {
    constructor() {
        this.organizations = [];
        this.referrals = [];
        this.auditLog = new AuditLog();
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        // Organization form handling
        document.getElementById('orgForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleOrganizationCreation(e.target);
        });

        // Referral form handling
        document.getElementById('referralForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleReferralCreation(e.target);
        });

        // Audit log viewer
        document.getElementById('viewAuditLog').addEventListener('click', () => {
            this.displayAuditLog();
        });
    }

    handleOrganizationCreation(form) {
        try {
            const name = form.orgName.value;
            const sessions = parseInt(form.sessionCount.value);
            const type = form.orgType.value;

            if (sessions % STANDARD_SESSION_PACKAGE !== 0) {
                throw new Error(`Session count must be a multiple of ${STANDARD_SESSION_PACKAGE}`);
            }

            const org = new Organization(name, sessions, type);
            this.organizations.push(org);
            
            this.auditLog.addEntry('CREATE_ORGANIZATION', {
                organizationId: org.id,
                name: org.name,
                sessions: org.totalSessions
            });

            form.reset();
            this.updateOrganizationList();
            this.updateOrganizationSelect();
            this.updateSessionStats();
            
            this.showSuccess('Organization created successfully');
        } catch (error) {
            this.showError(error.message);
        }
    }

    handleReferralCreation(form) {
        try {
            const orgId = form.orgSelect.value;
            const org = this.organizations.find(o => o.id === orgId);

            if (!org) {
                throw new Error('Organization not found');
            }

            if (!org.canReserveSession()) {
                throw new Error('Insufficient sessions available');
            }

            const referral = {
                id: Date.now().toString(),
                organizationId: org.id,
                name: form.ypName.value,
                email: form.ypEmail.value,
                phone: form.ypPhone.value,
                status: 'pending',
                createdAt: new Date(),
                sessionsReserved: STANDARD_SESSION_PACKAGE,
                sessionsUsed: 0
            };

            org.reserveSessions();
            this.referrals.push(referral);

            this.auditLog.addEntry('CREATE_REFERRAL', {
                referralId: referral.id,
                organizationId: org.id,
                sessionsReserved: STANDARD_SESSION_PACKAGE
            });

            form.reset();
            this.updateUI();
            this.showSuccess('Referral created successfully');
            this.sendConsentEmail(referral);
        } catch (error) {
            this.showError(error.message);
        }
    }

    updateUI() {
        this.updateOrganizationList();
        this.updateOrganizationSelect();
        this.updateSessionStats();
    }

    updateOrganizationList() {
        const list = document.getElementById('orgListContent');
        list.innerHTML = this.organizations.map(org => `
            <div class="session-info">
                <strong>${org.name}</strong> (${org.type})<br>
                Total Sessions: ${org.totalSessions}<br>
                Reserved: ${org.reservedSessions}<br>
                Available: ${org.remainingSessions}
            </div>
        `).join('');
    }

    updateOrganizationSelect() {
        const select = document.getElementById('orgSelect');
        // Clear existing options
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an organization';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // Filter and add organizations
        const availableOrgs = this.organizations.filter(org => org.canReserveSession());
        
        if (availableOrgs.length === 0) {
            const noOrgsOption = document.createElement('option');
            noOrgsOption.value = '';
            noOrgsOption.disabled = true;
            noOrgsOption.textContent = 'No organizations with available sessions';
            select.appendChild(noOrgsOption);
        } else {
            availableOrgs.forEach(org => {
                const option = document.createElement('option');
                option.value = org.id;
                option.textContent = `${org.name} (${org.remainingSessions} available)`;
                select.appendChild(option);
            });
        }
    }

    updateSessionStats() {
        document.getElementById('totalActiveSessions').textContent = 
            this.organizations.reduce((sum, org) => sum + org.totalSessions, 0);
        document.getElementById('reservedSessions').textContent = 
            this.organizations.reduce((sum, org) => sum + org.reservedSessions, 0);
    }

    displayAuditLog() {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h2>Audit Log</h2>
            <button class="modal-close">&times;</button>
        `;
        
        // Create log content
        const logContent = document.createElement('div');
        logContent.className = 'modal-body';
        
        // Format log entries
        const logEntries = this.auditLog.logs.map(log => `
            <div class="log-entry">
                <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
                <div class="log-action">${log.action}</div>
                <div class="log-details">
                    ${Object.entries(log.details).map(([key, value]) => 
                        `<div><strong>${key}:</strong> ${value}</div>`
                    ).join('')}
                </div>
            </div>
        `).join('');
        
        logContent.innerHTML = logEntries || '<p>No audit records found</p>';
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(logContent);
        modal.appendChild(modalContent);
        
        // Add close functionality
        const closeModal = () => {
            modal.classList.add('modal-closing');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Add to document
        document.body.appendChild(modal);
        
        // Trigger animation
        setTimeout(() => modal.classList.add('modal-open'), 50);
    }

    showSuccess(message) {
        // Create a success notification that matches TCS style
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Create an error notification that matches TCS style
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    sendConsentEmail(referral) {
        // Simulate sending consent email
        console.log(`Sending consent email to ${referral.email}`, {
            subject: 'Consent Required for TCS Therapy Sessions',
            body: `Dear ${referral.name},\n\nPlease provide your consent for therapy sessions...`
        });
    }
}

// Initialize the system when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManagementSystem = new SessionManagementSystem();
}); 