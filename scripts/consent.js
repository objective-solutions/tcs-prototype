class ConsentManager {
    constructor() {
        this.state = window.appState;
        this.referralId = new URLSearchParams(window.location.search).get('id');
        this.initializeEventListeners();
        this.validateAccess();
    }

    initializeEventListeners() {
        document.getElementById('consentBtn').addEventListener('click', () => {
            this.handleConsent(true);
        });

        document.getElementById('declineBtn').addEventListener('click', () => {
            this.handleConsent(false);
        });
    }

    validateAccess() {
        try {
            // Only validate if we have a referral ID (allows direct access to blank form)
            if (this.referralId) {
                const referral = this.state.referrals.find(r => r.id === this.referralId);
                if (!referral) throw new Error('Invalid consent link');
                if (referral.status !== 'pending') throw new Error('Consent already processed');
            } else {
                // Show blank form for direct access
                document.querySelector('.consent-form').classList.add('sample-form');
                document.querySelector('.consent-actions').style.display = 'none';
            }
        } catch (error) {
            this.showError(error.message);
            document.querySelector('.consent-form').innerHTML = `
                <div class="error-message">
                    <h3>Access Error</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async handleConsent(consented) {
        try {
            const referral = this.state.referrals.find(r => r.id === this.referralId);
            if (!referral) throw new Error('Referral not found');

            // Record consent
            this.state.recordConsent(this.referralId, 'therapy', consented ? 'consented' : 'declined');
            
            // Update referral status
            this.state.updateReferral(this.referralId, {
                status: consented ? 'consented' : 'declined',
                consentDate: new Date().toISOString()
            });

            // Show confirmation
            document.querySelector('.consent-form').innerHTML = `
                <div class="success-message">
                    <h3>${consented ? 'Consent Recorded' : 'Consent Declined'}</h3>
                    <p>${consented ? 
                        'Thank you for your consent. We will contact you soon to schedule your first session.' : 
                        'You have declined consent. No further action is needed.'}</p>
                </div>
            `;

        } catch (error) {
            this.showError(error.message);
        }
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
        setTimeout(() => notification.remove(), 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.consentManager = new ConsentManager();
}); 