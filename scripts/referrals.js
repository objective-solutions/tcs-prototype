class ReferralManager {
    constructor() {
        this.state = window.appState;
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        // Referral form submission
        document.getElementById('referralForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleReferralSubmission(e.target);
        });

        // Status filter
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterReferrals(e.target.value);
        });

        // Listen for organization updates
        window.addEventListener('organizationsUpdated', () => {
            this.updateOrganizationSelect();
        });
    }

    async handleReferralSubmission(form) {
        try {
            const referral = {
                id: Date.now().toString(),
                organizationId: form.orgSelect.value,
                name: form.ypName.value,
                dob: form.ypDob.value,
                email: form.ypEmail.value,
                phone: form.ypPhone.value,
                preferredContact: form.preferredContact.value,
                scheduleConstraints: form.scheduleConstraints.value,
                status: 'pending',
                createdAt: new Date().toISOString(),
                sessionsReserved: 12,
                sessionsUsed: 0
            };

            // Add referral and reserve sessions
            this.state.addReferral(referral);

            // Send consent request
            await this.sendConsentRequest(referral);

            // Update UI
            form.reset();
            this.updateUI();
            this.showSuccess('Referral created successfully. Consent request sent.');

            // Trigger event for other components
            window.dispatchEvent(new CustomEvent('referralsUpdated'));

        } catch (error) {
            this.showError(error.message);
        }
    }

    async sendConsentRequest(referral) {
        const consentLink = `${window.location.origin}/consent.html?id=${referral.id}`;
        
        const message = {
            to: referral.preferredContact === 'email' ? referral.email : referral.phone,
            method: referral.preferredContact,
            subject: 'Therapy Consent Required',
            content: `
                Dear ${referral.name},
                
                You have been referred for therapy sessions with The Children's Society.
                Please review and provide your consent using the link below:
                
                ${consentLink}
                
                This link is unique to you and should not be shared.
                
                Best regards,
                The Children's Society
            `
        };

        // In a real implementation, this would send an actual email/SMS
        console.log('Sending consent request:', message);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update referral status
        this.state.updateReferral(referral.id, { 
            consentRequestSent: new Date().toISOString() 
        });
    }

    filterReferrals(status) {
        const referrals = status === 'all' 
            ? this.state.referrals 
            : this.state.referrals.filter(r => r.status === status);
        
        this.renderReferralsList(referrals);
    }

    renderReferralsList(referrals) {
        const list = document.getElementById('referralsList');
        if (!list) return;

        if (referrals.length === 0) {
            list.innerHTML = '<p class="no-data">No referrals found</p>';
            return;
        }

        list.innerHTML = referrals.map(ref => {
            const org = this.state.organizations.find(o => o.id === ref.organizationId);
            return `
                <div class="referral-card ${ref.status}">
                    <div class="referral-header">
                        <h3>${ref.name}</h3>
                        <span class="status-badge">${ref.status}</span>
                    </div>
                    <div class="referral-details">
                        <p><strong>Organization:</strong> ${org ? org.name : 'Unknown'}</p>
                        <p><strong>Contact:</strong> ${ref.preferredContact === 'email' ? ref.email : ref.phone}</p>
                        <p><strong>Created:</strong> ${new Date(ref.createdAt).toLocaleDateString()}</p>
                        <p><strong>Sessions:</strong> ${ref.sessionsUsed}/${ref.sessionsReserved}</p>
                    </div>
                    <div class="referral-actions">
                        ${this.getReferralActions(ref)}
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for actions
        list.querySelectorAll('.referral-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const { action, referralId } = e.target.dataset;
                this.handleReferralAction(action, referralId);
            });
        });
    }

    getReferralActions(referral) {
        let actions = '';
        
        switch (referral.status) {
            case 'pending':
                actions = `
                    <button class="btn btn-secondary referral-action" 
                            data-action="resend-consent" 
                            data-referral-id="${referral.id}">
                        Resend Consent
                    </button>
                `;
                break;
            case 'consented':
                actions = `
                    <a href="scheduling.html?referral=${referral.id}" 
                       class="btn btn-primary">
                        Schedule Session
                    </a>
                `;
                break;
            case 'scheduled':
                actions = `
                    <a href="scheduling.html?referral=${referral.id}" 
                       class="btn btn-secondary">
                        View/Modify Schedule
                    </a>
                `;
                break;
        }
        
        return actions;
    }

    async handleReferralAction(action, referralId) {
        try {
            switch (action) {
                case 'resend-consent':
                    const referral = this.state.referrals.find(r => r.id === referralId);
                    await this.sendConsentRequest(referral);
                    this.showSuccess('Consent request resent');
                    break;
                case 'schedule':
                    // This would open the scheduling interface
                    this.showInfo('Scheduling feature coming soon');
                    break;
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    updateUI() {
        this.updateOrganizationSelect();
        this.filterReferrals(document.getElementById('statusFilter').value);
    }

    updateOrganizationSelect() {
        const select = document.getElementById('orgSelect');
        if (!select) return;

        // Clear existing options
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an organization';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // Add organization options - include both purchasers and referrers
        const organizations = this.state.organizations;
        
        if (organizations.length === 0) {
            const noOrgsOption = document.createElement('option');
            noOrgsOption.value = '';
            noOrgsOption.disabled = true;
            noOrgsOption.textContent = 'No organizations available';
            select.appendChild(noOrgsOption);
        } else {
            organizations.forEach(org => {
                const option = document.createElement('option');
                option.value = org.id;
                const availableSessions = org.totalSessions - org.reservedSessions;
                const sessionInfo = org.type === 'purchaser' ? ` (${availableSessions} available)` : ' (Referrer)';
                option.textContent = `${org.name}${sessionInfo}`;
                select.appendChild(option);
            });
        }
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // ... rest of the existing methods ...
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.referralManager = new ReferralManager();
}); 