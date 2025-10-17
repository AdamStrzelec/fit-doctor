import Link from "next/link";

const navItems = [
  { href: "/user", label: "Dashboard" },
  { href: "/user/trainings", label: "Treningi" },
  { href: "/user/exercises", label: "Ćwiczenia" },
  { href: "/user/progress", label: "Progres" },
  { href: "/user/settings", label: "Ustawienia" },
];

export default function Sidebar() {
  return (
    <nav
      style={{
        width: "220px",
        background: "#fafafa",
        borderRight: "1px solid #eee",
        padding: "2rem 1rem",
        minHeight: "100vh",
      }}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {navItems.map((item) => (
          <li key={item.href} style={{ marginBottom: 16 }}>
            <Link
              href={item.href}
              style={{
                textDecoration: "none",
                color: "#222",
                fontWeight: "bold",
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
