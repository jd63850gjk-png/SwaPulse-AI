"use client";

import { useState } from "react";
import GuestDashboard from "@/components/GuestDashboard";
import LoginScreen from "@/components/LoginScreen";

export type DemoRole = "admin" | "manager" | "worker";

export default function Home() {
  const [role, setRole] = useState<DemoRole>("admin");
  const [isGuest, setIsGuest] = useState(false);

  if (isGuest) {
    return (
      <GuestDashboard
        role={role}
        onSwitchRole={setRole}
        onExit={() => setIsGuest(false)}
      />
    );
  }

  return (
    <LoginScreen
      selectedRole={role}
      onSelectRole={setRole}
      onGuestLogin={() => setIsGuest(true)}
    />
  );
}
