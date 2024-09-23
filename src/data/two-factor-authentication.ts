import { db } from "@/lib/db";

export const getTwoFactorAuthenticationByUserId = async (userId: string) => {
    try {
        const twoFactorAuthentication = await db.twoFactorAuthentication.findUnique({
            where: { userId }
        });
        
        return twoFactorAuthentication;
    } catch {
        return null;
    }
}