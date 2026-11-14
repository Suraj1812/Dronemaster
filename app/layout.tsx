import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'Dronemaster · Inspection workspace',template:'%s · Dronemaster'},description:'Private inspections, image intelligence and bilingual reports.',icons:{icon:'/dronemaster-logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
