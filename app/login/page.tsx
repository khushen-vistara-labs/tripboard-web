import type { Metadata } from "next";
import { LoginPage } from "../../src/features/auth/LoginPage";
export const metadata: Metadata = { title: "Sign in", description: "Sign in to your private shared TripBoard with an email code." };
export default function SignInPage() { return <LoginPage/>; }
