'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import bcrypt from 'bcrypt';

const FormSchema = z.object({
    id: z.string(),
    sellerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['awaiting', 'fulfilled']),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

const UserFormSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    password: z.string(),
    passwordConfirm: z.string(),
    date: z.string(),
})

const AddUser = UserFormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    const { sellerId, amount, status } = CreateInvoice.parse({
        sellerId: formData.get('sellerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    await sql`
INSERT INTO invoices (seller_id, amount, status, date)
VALUES (${sellerId}, ${amountInCents}, ${status}, ${date})
`;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
    const { sellerId, amount, status } = UpdateInvoice.parse({
        sellerId: formData.get('sellerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    await sql`
        UPDATE invoices
        SET seller_id = ${sellerId}, amount = ${amountInCents}, status = ${status}
        WHERE ID = ${id}
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}

export async function addUserToDB(
    formData: FormData,
) {
    try {
        const { name, email, password, passwordConfirm } = AddUser.parse({
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            passwordConfirm: formData.get('passwordConfirm'),
        });
        if (password != passwordConfirm) {
            return;

        }
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        await sql`
INSERT INTO users (name, email, password)
VALUES (${name}, ${email}, ${hash})
`;

    } catch (error) {
        throw error;

    }
}
