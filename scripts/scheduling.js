class SchedulingManager {
    constructor() {
        this.state = window.appState;
        this.initializeEventListeners();
        
        // Check for referral parameter
        const params = new URLSearchParams(window.location.search);
        this.selectedReferralId = params.get('referral');
        
        this.updateUI();
    }

    initializeEventListeners() {
        // Calendar navigation
        document.getElementById('prevWeek')?.addEventListener('click', () => this.navigateWeek(-1));
        document.getElementById('nextWeek')?.addEventListener('click', () => this.navigateWeek(1));
        
        // Block time form
        document.getElementById('blockTimeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBlockTime(e.target);
        });

        // Recurring availability form
        document.getElementById('availabilityForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSetAvailability(e.target);
        });
    }

    async scheduleSession(referralId, slot) {
        try {
            const referral = this.state.referrals.find(r => r.id === referralId);
            if (!referral) throw new Error('Referral not found');

            const appointment = {
                id: Date.now().toString(),
                referralId,
                startTime: slot.startTime,
                endTime: slot.endTime,
                type: referral.status === 'consented' ? 'assessment' : 'therapy',
                status: 'scheduled'
            };

            // Add to appointments
            this.state.addAppointment(appointment);

            // Send confirmation
            await this.sendAppointmentConfirmation(appointment, referral);

            // Schedule reminder
            this.scheduleReminder(appointment, referral);

            return appointment;
        } catch (error) {
            throw new Error(`Failed to schedule session: ${error.message}`);
        }
    }

    async cancelSession(appointmentId, reason) {
        try {
            const appointment = this.state.appointments.find(a => a.id === appointmentId);
            if (!appointment) throw new Error('Appointment not found');

            const referral = this.state.referrals.find(r => r.id === appointment.referralId);
            if (!referral) throw new Error('Referral not found');

            // Update appointment status
            appointment.status = 'cancelled';
            appointment.cancellationReason = reason;
            appointment.cancelledAt = new Date().toISOString();

            // If therapist cancelled, don't count against session allocation
            if (reason === 'therapist') {
                referral.sessionsReserved += 1;
            }

            // Save changes
            this.state.updateAppointment(appointment);
            this.state.updateReferral(referral.id, { 
                sessionsReserved: referral.sessionsReserved 
            });

            // Notify young person
            await this.sendCancellationNotification(appointment, referral, reason);

            return appointment;
        } catch (error) {
            throw new Error(`Failed to cancel session: ${error.message}`);
        }
    }

    async sendAppointmentConfirmation(appointment, referral) {
        const message = {
            to: referral.preferredContact === 'email' ? referral.email : referral.phone,
            method: referral.preferredContact,
            subject: 'Your therapy session has been scheduled',
            content: `
                Dear ${referral.name},
                
                Your therapy session has been scheduled for:
                Date: ${new Date(appointment.startTime).toLocaleDateString()}
                Time: ${new Date(appointment.startTime).toLocaleTimeString()}
                
                The session will last 50 minutes.
                
                Best regards,
                The Children's Society
            `
        };

        await this.sendCommunication(message);
    }

    async sendCancellationNotification(appointment, referral, reason) {
        const message = {
            to: referral.preferredContact === 'email' ? referral.email : referral.phone,
            method: referral.preferredContact,
            subject: 'Therapy session cancelled',
            content: `
                Dear ${referral.name},
                
                Your therapy session scheduled for ${new Date(appointment.startTime).toLocaleString()} 
                has been cancelled${reason === 'therapist' ? ' by your therapist' : ''}.
                
                ${reason === 'therapist' ? 'We will contact you soon to reschedule.' : ''}
                
                Best regards,
                The Children's Society
            `
        };

        await this.sendCommunication(message);
    }

    scheduleReminder(appointment, referral) {
        // In a real implementation, this would use a job queue
        const reminderTime = new Date(appointment.startTime);
        reminderTime.setDate(reminderTime.getDate() - 1);

        const message = {
            to: referral.preferredContact === 'email' ? referral.email : referral.phone,
            method: referral.preferredContact,
            subject: 'Reminder: Therapy session tomorrow',
            content: `
                Dear ${referral.name},
                
                This is a reminder that you have a therapy session scheduled for:
                Date: ${new Date(appointment.startTime).toLocaleDateString()}
                Time: ${new Date(appointment.startTime).toLocaleTimeString()}
                
                The session will last 50 minutes.
                
                Best regards,
                The Children's Society
            `
        };

        // Schedule the reminder
        setTimeout(() => {
            this.sendCommunication(message);
        }, reminderTime.getTime() - Date.now());
    }

    async sendCommunication(message) {
        // In a real implementation, this would use actual email/SMS services
        console.log(`Sending ${message.method} to ${message.to}:`, message);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Log the communication
        this.state.addAuditLog('SEND_COMMUNICATION', {
            method: message.method,
            recipient: message.to,
            subject: message.subject
        });
    }

    updateUI() {
        this.renderCalendar();
        this.updateCurrentWeek();
    }

    navigateWeek(offset) {
        const currentWeek = document.getElementById('currentWeek').dataset.startDate;
        const date = new Date(currentWeek);
        date.setDate(date.getDate() + (offset * 7));
        this.renderCalendar(date);
        this.updateCurrentWeek(date);
    }

    updateCurrentWeek(date = new Date()) {
        const weekStart = this.getWeekStart(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 4);

        const element = document.getElementById('currentWeek');
        element.textContent = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
        element.dataset.startDate = weekStart.toISOString();
    }

    renderCalendar(date = new Date()) {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = this.generateCalendarHTML(date);

        // Add click handlers for available slots
        grid.querySelectorAll('.time-slot:not(.unavailable):not(.blocked)').forEach(slot => {
            slot.addEventListener('click', () => {
                const { date, time } = slot.dataset;
                this.showAppointmentModal(date, time);
            });
        });
    }

    generateCalendarHTML(date) {
        const weekStart = this.getWeekStart(date);
        const hours = this.generateHours();
        const days = this.generateDays(weekStart);

        return `
            <div class="time-label"></div>
            ${days.map(day => `
                <div class="calendar-header">
                    ${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
            `).join('')}
            ${hours.map(hour => `
                <div class="time-label">${hour}:00</div>
                ${days.map(day => {
                    const slotDate = new Date(day);
                    slotDate.setHours(hour);
                    return this.generateTimeSlot(slotDate);
                }).join('')}
            `).join('')}
        `;
    }

    generateTimeSlot(date) {
        const dateStr = date.toISOString();
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        // Check availability
        const isAvailable = this.checkAvailability(date);
        const appointment = this.findAppointment(date);
        
        let className = 'time-slot';
        if (!isAvailable) className += ' unavailable';
        if (appointment) className += ' booked';

        return `
            <div class="${className}" 
                 data-date="${dateStr}" 
                 data-time="${timeStr}">
                ${appointment ? this.formatAppointmentInfo(appointment) : ''}
            </div>
        `;
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    generateHours() {
        return Array.from({ length: 9 }, (_, i) => i + 9); // 9 AM to 5 PM
    }

    generateDays(startDate) {
        return Array.from({ length: 5 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            return date;
        });
    }

    checkAvailability(date) {
        // Get current therapist
        const therapist = this.state.therapists[0]; // For now, just use first therapist
        if (!therapist) return false;

        return therapist.isAvailable(date, new Date(date.getTime() + 50 * 60000)); // 50 minutes
    }

    findAppointment(date) {
        return this.state.appointments.find(apt => {
            const aptStart = new Date(apt.startTime);
            return aptStart.getTime() === date.getTime();
        });
    }

    formatAppointmentInfo(appointment) {
        const referral = this.state.referrals.find(r => r.id === appointment.referralId);
        if (!referral) return '';

        return `
            <div class="appointment-info">
                <strong>${referral.name}</strong><br>
                ${appointment.type}
            </div>
        `;
    }

    showAppointmentModal(dateStr, timeStr) {
        const template = document.getElementById('appointmentModalTemplate');
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = template.innerHTML;
        
        // Set slot info
        const date = new Date(dateStr);
        modal.querySelector('#slotDate').textContent = date.toLocaleDateString();
        modal.querySelector('#slotTime').textContent = timeStr;
        
        // Populate referral select
        this.populateReferralSelect(modal.querySelector('#referralSelect'));
        
        // Pre-select referral if specified
        if (this.selectedReferralId) {
            const referralSelect = modal.querySelector('#referralSelect');
            referralSelect.value = this.selectedReferralId;
            referralSelect.disabled = true; // Lock the selection
        }
        
        // Add event listeners
        const closeModal = () => {
            modal.classList.remove('modal-open');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        modal.querySelector('#appointmentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAppointmentSubmission(e.target, date, closeModal);
        });
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('modal-open'), 50);
    }

    populateReferralSelect(select) {
        // Get eligible referrals (consented but not fully scheduled)
        const eligibleReferrals = this.state.referrals.filter(r => 
            r.status === 'consented' && 
            r.sessionsUsed < r.sessionsReserved
        );
        
        select.innerHTML = `
            <option value="" disabled selected>Select a young person</option>
            ${eligibleReferrals.map(r => `
                <option value="${r.id}">
                    ${r.name} (${r.sessionsUsed}/${r.sessionsReserved} sessions used)
                </option>
            `).join('')}
        `;
    }

    async handleAppointmentSubmission(form, date, closeModal) {
        try {
            const slot = {
                startTime: date.toISOString(),
                endTime: new Date(date.getTime() + 50 * 60000).toISOString() // 50 minutes
            };
            
            const appointment = await this.scheduleSession(form.referralSelect.value, slot);
            
            this.showSuccess('Session scheduled successfully');
            closeModal();
            this.updateUI();
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleSetAvailability(form) {
        try {
            const availability = {
                day: parseInt(form.daySelect.value),
                startTime: form.startTime.value,
                endTime: form.endTime.value
            };

            // Get current therapist
            let therapist = this.state.therapists[0];
            if (!therapist) {
                // Create default therapist if none exists
                therapist = {
                    id: Date.now().toString(),
                    name: 'Default Therapist',
                    email: 'therapist@example.com',
                    availability: [],
                    blockedTimes: [],
                    appointments: []
                };
                this.state.therapists.push(therapist);
            }

            // Update availability
            const existingIndex = therapist.availability.findIndex(a => a.day === availability.day);
            if (existingIndex >= 0) {
                therapist.availability[existingIndex] = availability;
            } else {
                therapist.availability.push(availability);
            }

            // Save changes
            this.state.saveToStorage('therapists', this.state.therapists);
            this.state.addAuditLog('UPDATE_AVAILABILITY', availability);

            this.showSuccess('Availability updated successfully');
            this.updateUI();
            form.reset();

        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleBlockTime(form) {
        try {
            const blockTime = {
                start: new Date(`${form.blockStartDate.value}T${form.blockStartTime.value}`).toISOString(),
                end: new Date(`${form.blockEndDate.value}T${form.blockEndTime.value}`).toISOString(),
                reason: form.blockReason.value
            };

            // Get current therapist
            let therapist = this.state.therapists[0];
            if (!therapist) throw new Error('No therapist found');

            // Add blocked time
            therapist.blockedTimes.push(blockTime);

            // Save changes
            this.state.saveToStorage('therapists', this.state.therapists);
            this.state.addAuditLog('BLOCK_TIME', blockTime);

            this.showSuccess('Time blocked successfully');
            this.updateUI();
            form.reset();

        } catch (error) {
            this.showError(error.message);
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
        setTimeout(() => notification.remove(), 3000);
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

    // ... add more UI helper methods ...
} 