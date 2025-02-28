class Therapist {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.email = data.email;
        this.availability = data.availability || [];
        this.blockedTimes = data.blockedTimes || [];
        this.appointments = data.appointments || [];
    }

    isAvailable(startTime, endTime) {
        // Check if time is within working hours
        const timeSlot = new Date(startTime);
        const dayOfWeek = timeSlot.getDay();
        const dayAvailability = this.availability.find(a => a.day === dayOfWeek);
        
        if (!dayAvailability) return false;

        // Check if time is blocked
        const isBlocked = this.blockedTimes.some(block => 
            new Date(block.start) <= new Date(startTime) && 
            new Date(block.end) >= new Date(endTime)
        );

        if (isBlocked) return false;

        // Check for existing appointments
        const hasConflict = this.appointments.some(apt => 
            new Date(apt.startTime) < new Date(endTime) && 
            new Date(apt.endTime) > new Date(startTime)
        );

        return !hasConflict;
    }

    getAvailableSlots(date) {
        const slots = [];
        const dayOfWeek = new Date(date).getDay();
        const dayAvailability = this.availability.find(a => a.day === dayOfWeek);

        if (!dayAvailability) return slots;

        // Generate hourly slots during available hours
        const startHour = parseInt(dayAvailability.startTime.split(':')[0]);
        const endHour = parseInt(dayAvailability.endTime.split(':')[0]);

        for (let hour = startHour; hour < endHour; hour++) {
            const slotStart = new Date(date);
            slotStart.setHours(hour, 0, 0, 0);
            
            const slotEnd = new Date(slotStart);
            slotEnd.setHours(hour + 1);

            if (this.isAvailable(slotStart, slotEnd)) {
                slots.push({
                    startTime: slotStart.toISOString(),
                    endTime: slotEnd.toISOString()
                });
            }
        }

        return slots;
    }
} 