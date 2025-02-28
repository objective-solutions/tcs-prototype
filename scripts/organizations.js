class OrganizationManager {
    constructor() {
        this.state = window.appState;
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        // Organization form handling
        document.getElementById('orgForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleOrganizationCreation(e.target);
        });
    }

    handleOrganizationCreation(form) {
        try {
            const name = form.orgName.value;
            const sessions = parseInt(form.sessionCount.value);
            const type = form.orgType.value;

            if (sessions % 12 !== 0) {
                throw new Error('Session count must be a multiple of 12');
            }

            const organization = {
                id: Date.now().toString(),
                name,
                totalSessions: sessions,
                type,
                reservedSessions: 0,
                usedSessions: 0,
                active: true,
                createdAt: new Date().toISOString()
            };

            // Use the new addOrganization method
            this.state.addOrganization(organization);

            // Update 
            form.reset();
            this.updateUI();
            this.showSuccess('Organization created successfully');

            // Trigger an event to notify other components
            window.dispatchEvent(new CustomEvent('organizationsUpdated'));

        } catch (error) {
            this.showError(error.message);
        }
    }

    updateUI() {
        this.updateOrganizationList();
    }

    updateOrganizationList() {
        const list = document.getElementById('orgListContent');
        if (!list) return;

        list.innerHTML = this.state.organizations.map(org => `
            <div class="organization-card">
                <div class="organization-header">
                    <h3>${org.name}</h3>
                    <span class="org-type">${org.type}</span>
                </div>
                <div class="organization-stats">
                    <div class="stat">
                        <span class="stat-label">Total Sessions:</span>
                        <span class="stat-value">${org.totalSessions}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Reserved:</span>
                        <span class="stat-value">${org.reservedSessions}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Available:</span>
                        <span class="stat-value">${org.totalSessions - org.reservedSessions}</span>
                    </div>
                </div>
            </div>
        `).join('');
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.organizationManager = new OrganizationManager();
}); 