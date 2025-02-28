// State management for the application
class AppState {
    constructor() {
        this.organizations = this.loadFromStorage('organizations') || [];
        this.referrals = this.loadFromStorage('referrals') || [];
        this.auditLog = this.loadFromStorage('auditLog') || [];
        
        // Restore methods to organizations after loading from storage
        this.organizations.forEach(this.addOrganizationMethods);
    }

    // Storage methods
    loadFromStorage(key) {
        const data = localStorage.getItem(`tcs_${key}`);
        return data ? JSON.parse(data) : null;
    }

    saveToStorage(key, data) {
        localStorage.setItem(`tcs_${key}`, JSON.stringify(data));
    }

    // Organization methods
    addOrganization(organization) {
        this.addOrganizationMethods(organization);
        this.organizations.push(organization);
        this.saveToStorage('organizations', this.organizations);
        this.addAuditLog('CREATE_ORGANIZATION', {
            organizationId: organization.id,
            name: organization.name,
            sessions: organization.totalSessions
        });
    }

    updateOrganization(organizationId, updates) {
        const index = this.organizations.findIndex(o => o.id === organizationId);
        if (index === -1) throw new Error('Organization not found');

        this.organizations[index] = { ...this.organizations[index], ...updates };
        this.saveToStorage('organizations', this.organizations);
        this.addAuditLog('UPDATE_ORGANIZATION', { organizationId, updates });
    }

    // Referral methods
    addReferral(referral) {
        // Check for duplicates
        const isDuplicate = this.referrals.some(r => 
            r.email === referral.email && 
            r.name.toLowerCase() === referral.name.toLowerCase()
        );

        if (isDuplicate) {
            throw new Error('A referral for this young person already exists');
        }

        // Find and verify organization
        const organization = this.organizations.find(o => o.id === referral.organizationId);
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Reserve sessions
        try {
            organization.reserveSessions();
            this.updateOrganization(organization.id, {
                reservedSessions: organization.reservedSessions
            });
        } catch (error) {
            throw new Error(`Failed to reserve sessions: ${error.message}`);
        }

        this.referrals.push(referral);
        this.saveToStorage('referrals', this.referrals);
        this.addAuditLog('CREATE_REFERRAL', referral);
    }

    updateReferral(referralId, updates) {
        const index = this.referrals.findIndex(r => r.id === referralId);
        if (index === -1) throw new Error('Referral not found');

        this.referrals[index] = { ...this.referrals[index], ...updates };
        this.saveToStorage('referrals', this.referrals);
        this.addAuditLog('UPDATE_REFERRAL', { referralId, updates });
    }

    // Consent methods
    recordConsent(referralId, consentType, status) {
        const referral = this.referrals.find(r => r.id === referralId);
        if (!referral) throw new Error('Referral not found');

        const consentRecord = {
            timestamp: new Date().toISOString(),
            type: consentType,
            status,
            referralId
        };

        referral.consent = consentRecord;
        this.updateReferral(referralId, { consent: consentRecord });
        this.addAuditLog('RECORD_CONSENT', consentRecord);
    }

    // Audit logging
    addAuditLog(action, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            details,
            id: Date.now().toString()
        };

        this.auditLog.unshift(logEntry);
        this.saveToStorage('auditLog', this.auditLog);
    }

    // Add this new method
    addOrganizationMethods(organization) {
        organization.canReserveSession = function(count = 12) {
            return this.type === 'purchaser' && 
                   (this.totalSessions - this.reservedSessions) >= count;
        };

        organization.reserveSessions = function(count = 12) {
            if (!this.canReserveSession(count)) {
                throw new Error(`Unable to reserve ${count} sessions. Available: ${this.totalSessions - this.reservedSessions}`);
            }
            this.reservedSessions += count;
            return true;
        };
    }
}

// Initialize global state
window.appState = new AppState(); 