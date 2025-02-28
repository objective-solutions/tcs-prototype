class SessionManager {
    constructor() {
        this.state = window.appState;
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        // Audit log button
        document.getElementById('viewAuditLog').addEventListener('click', () => {
            this.displayAuditLog();
        });

        // Listen for updates
        window.addEventListener('organizationsUpdated', () => {
            this.updateUI();
        });
    }

    updateUI() {
        this.updateSessionStats();
    }

    updateSessionStats() {
        // Calculate total active sessions
        const totalActive = this.state.organizations.reduce((sum, org) => 
            sum + org.totalSessions, 0);
        document.getElementById('totalActiveSessions').textContent = totalActive;

        // Calculate reserved sessions
        const reserved = this.state.organizations.reduce((sum, org) => 
            sum + org.reservedSessions, 0);
        document.getElementById('reservedSessions').textContent = reserved;
    }

    displayAuditLog() {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content audit-log-modal';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h2>Session Audit Log</h2>
            <button class="modal-close">&times;</button>
        `;
        
        // Create log content
        const logContent = document.createElement('div');
        logContent.className = 'modal-body';
        
        // Group logs by date
        const groupedLogs = this.groupLogsByDate(this.state.auditLog);
        
        // Format log entries
        const logHtml = Object.entries(groupedLogs).map(([date, logs]) => `
            <div class="audit-log-date">
                <h3>${date}</h3>
                <div class="audit-log-entries">
                    ${logs.map(log => this.formatLogEntry(log)).join('')}
                </div>
            </div>
        `).join('');
        
        logContent.innerHTML = logHtml || '<p>No audit records found</p>';
        
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

    groupLogsByDate(logs) {
        return logs.reduce((groups, log) => {
            const date = new Date(log.timestamp).toLocaleDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(log);
            return groups;
        }, {});
    }

    formatLogEntry(log) {
        const time = new Date(log.timestamp).toLocaleTimeString();
        let detailsHtml = '';

        switch (log.action) {
            case 'CREATE_ORGANIZATION':
                detailsHtml = `
                    <strong>Organization:</strong> ${log.details.name}<br>
                    <strong>Sessions:</strong> ${log.details.sessions}
                `;
                break;
            case 'CREATE_REFERRAL':
                detailsHtml = `
                    <strong>Name:</strong> ${log.details.name}<br>
                    <strong>Sessions Reserved:</strong> ${log.details.sessionsReserved}
                `;
                break;
            case 'RECORD_CONSENT':
                detailsHtml = `
                    <strong>Type:</strong> ${log.details.type}<br>
                    <strong>Status:</strong> ${log.details.status}
                `;
                break;
            default:
                detailsHtml = Object.entries(log.details)
                    .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                    .join('<br>');
        }

        return `
            <div class="audit-log-entry">
                <div class="log-time">${time}</div>
                <div class="log-action">${log.action}</div>
                <div class="log-details">
                    ${detailsHtml}
                </div>
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
}); 