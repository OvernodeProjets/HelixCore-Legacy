import { IUser } from '../../handlers/user';
import Manager from '../../handlers/manager';

interface ServerData {
    name: string;
    ram: number;
    disk: number;
    cpu: number;
    backup: number;
    database: number;
    allocation: number;
}

interface ValidationResult {
    success: boolean;
    message?: string;
}

export async function validateServerCreation({
    user,
    serverData,
    manager
}: {
    user: IUser;
    serverData: ServerData;
    manager: Manager;
}): Promise<ValidationResult> {
    const { name, ram, disk, cpu, backup, database, allocation } = serverData;

    const [servers, max] = await Promise.all([
        manager.getServer(user.email),
        manager.getMaxResources(user.email)
    ]);

    if (servers.length >= max.servers) {
        return {
            success: false,
            message: 'You have reached the maximum number of servers'
        };
    }

    if (ram > max.ram || disk > max.disk || cpu > max.cpu || 
        backup > max.backup || database > max.database || 
        allocation > max.allocation) {
        return {
            success: false,
            message: 'Insufficient resources to create this server'
        };
    }

    if ([ram, disk, cpu, backup, database, allocation].some(value => value < 0)) {
        return {
            success: false,
            message: 'Resources cannot be negative'
        };
    }

    if ([ram, disk, cpu, backup, database, allocation].every(value => value === 0)) {
        return {
            success: false,
            message: 'At least one resource must be greater than 0'
        };
    }

    if (name.length < 3 || name.length > 20) {
        return {
            success: false,
            message: 'The name must be between 3 and 20 characters.'
        };
    }

    if (name.match(/[^a-zA-Z0-9]/)) {
        return {
            success: false,
            message: 'The name must only contain letters and numbers.'
        };
    }

    return { success: true };
}