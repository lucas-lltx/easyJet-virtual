import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase outside the component to avoid re-initialization
let app;
let db;
let auth;

try {
  if (Object.keys(firebaseConfig).length > 0) {
    // Corrected Firebase initialization: removed extra 'firebase' call
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } else {
    console.error("Firebase config is missing. Firestore will not be available.");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

// --- Gemini API Setup (for staff dashboard AI assistance - no longer used for drafting but kept for potential future use) ---
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with your actual Gemini API key for testing

const callGeminiApi = async (prompt, showTemporaryMessage) => {
    // This function is no longer called for drafting content as per user request.
    // Keeping it for future potential AI features, but ensuring it's not directly used now.
    console.warn("Gemini API call function is present but not actively used for content drafting as per user request.");
    return null; // Return null as it's not being used for content generation in this version.
};

// Main App Component
const App = () => {
    const [currentPage, setCurrentPage] = useState('home');
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isStaffLoggedIn, setIsStaffLoggedIn] = useState(false); // Simple staff login state
    const [showMessage, setShowMessage] = useState({ visible: false, type: '', text: '' });

    // Firebase Authentication and Initialization
    useEffect(() => {
        const initializeAndSignIn = async () => {
            if (!app || !auth) {
                console.error("Firebase app or auth not initialized.");
                setIsAuthReady(true); // Mark as ready even if not fully functional
                return;
            }

            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("Firebase Auth User ID:", user.uid);
                } else {
                    setUserId(null);
                    console.log("No Firebase Auth user.");
                }
                setIsAuthReady(true); // Auth state is ready
            });

            // Attempt to sign in
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log("Signed in with custom token.");
                } else {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                }
            } catch (error) {
                console.error("Error during Firebase sign-in:", error);
            }

            return () => unsubscribe();
        };

        initializeAndSignIn();
    }, []); // Run only once on component mount

    // Function to show temporary messages
    const showTemporaryMessage = (type, text) => {
        setShowMessage({ visible: true, type, text });
        setTimeout(() => {
            setShowMessage({ visible: false, type: '', text: '' });
        }, 4000); // Message disappears after 4 seconds
    };

    const navigate = (page) => {
        setCurrentPage(page);
    };

    // Navbar Component
    const Navbar = () => (
        <nav className="bg-white p-4 shadow-md rounded-b-lg mb-8 border-b border-gray-200">
            <div className="container mx-auto flex flex-wrap justify-between items-center">
                <div className="text-orange-500 text-3xl font-extrabold tracking-wider cursor-pointer transform hover:scale-105 transition-transform duration-300" onClick={() => navigate('home')}>
                    easyJet <span className="text-gray-700 text-base ml-2">Ro-Aviation</span>
                </div>
                <div className="flex space-x-6">
                    <NavItem title="Home" page="home" />
                    <NavItem title="Booking" page="booking" />
                    <NavItem title="Careers" page="careers" />
                    <NavItem title="Photo Album" page="photoAlbum" />
                    <NavItem title="Support" page="support" />
                    {!isStaffLoggedIn && <NavItem title="Staff Login" page="staffLogin" />}
                    {isStaffLoggedIn && <NavItem title="Staff Dashboard" page="staffDashboard" />}
                </div>
            </div>
        </nav>
    );

    const NavItem = ({ title, page }) => (
        <button
            onClick={() => navigate(page)}
            className={`text-gray-700 font-semibold py-2 px-4 rounded-lg transition-all duration-300
                        ${currentPage === page ? 'bg-orange-100 text-orange-600 shadow-inner' : 'hover:bg-gray-100 hover:text-orange-500'}`}
        >
            {title}
        </button>
    );

    // Footer Component
    const Footer = () => (
        <footer className="bg-gray-700 text-gray-300 p-6 mt-12 rounded-t-lg shadow-inner">
            <div className="container mx-auto text-center">
                <p>&copy; {new Date().getFullYear()} easyJet Ro-Aviation. All rights reserved. <span className="text-sm">User ID: {userId || 'Loading...'}</span></p>
                <div className="flex justify-center space-x-4 mt-4">
                    <a href="#" className="hover:text-white transition-colors duration-200">Privacy Policy</a>
                    <a href="#" className="hover:text-white transition-colors duration-200">Terms of Service</a>
                    <a href="#" className="hover:text-white transition-colors duration-200">Contact Us</a>
                </div>
            </div>
        </footer>
    );

    // Homepage Component
    const HomePage = () => {
        const [announcements, setAnnouncements] = useState([]);
        const [liveFlights, setLiveFlights] = useState([]);
        const [staffTeam, setStaffTeam] = useState([]); // New state for staff team
        const [fleet, setFleet] = useState([]); // New state for fleet

        // Roblox Group Link
        const robloxGroupLink = "https://www.roblox.com/communities/35102208/UK-Flight-Simulator";

        // Fetch announcements in real-time
        useEffect(() => {
            if (!db || !isAuthReady) return;

            const announcementsCollectionRef = collection(db, `artifacts/${appId}/public/data/announcements`);
            const q = query(announcementsCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedAnnouncements = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate()); // Sort by most recent
                setAnnouncements(fetchedAnnouncements);
                console.log("Announcements fetched:", fetchedAnnouncements);
            }, (error) => {
                console.error("Error fetching announcements:", error);
                showTemporaryMessage('error', 'Failed to load announcements.');
            });

            return () => unsubscribe();
        }, [db, isAuthReady]);

        // Fetch live flights in real-time
        useEffect(() => {
            if (!db || !isAuthReady) return;

            const liveFlightsCollectionRef = collection(db, `artifacts/${appId}/public/data/liveFlights`);
            const q = query(liveFlightsCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedLiveFlights = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => {
                    // Sort by status for better readability (e.g., En Route first)
                    const statusOrder = { 'En Route': 1, 'Departed': 2, 'Scheduled': 3, 'Arrived': 4, 'Cancelled': 5 };
                    const statusB = statusOrder[b.status] || 99;
                    const statusA = statusOrder[a.status] || 99;
                    if (statusA !== statusB) {
                        return statusA - statusB;
                    }
                    return 0; // Maintain original order if status is the same
                });
                setLiveFlights(fetchedLiveFlights);
                console.log("Live flights fetched:", fetchedLiveFlights);
            }, (error) => {
                console.error("Error fetching live flights:", error);
                showTemporaryMessage('error', 'Failed to load live flight data.');
            });

            return () => unsubscribe();
        }, [db, isAuthReady]);

        // Fetch Staff Team in real-time
        useEffect(() => {
            if (!db || !isAuthReady) return;

            const staffTeamCollectionRef = collection(db, `artifacts/${appId}/public/data/staffTeam`);
            const q = query(staffTeamCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedStaff = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => (a.order || 99) - (b.order || 99)); // Sort by 'order' field if present
                setStaffTeam(fetchedStaff);
                console.log("Staff Team fetched:", fetchedStaff);
            }, (error) => {
                console.error("Error fetching staff team:", error);
                showTemporaryMessage('error', 'Failed to load staff team data.');
            });

            return () => unsubscribe();
        }, [db, isAuthReady]);

        // Fetch Fleet in real-time
        useEffect(() => {
            if (!db || !isAuthReady) return;

            const fleetCollectionRef = collection(db, `artifacts/${appId}/public/data/fleet`);
            const q = query(fleetCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedFleet = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => (a.order || 99) - (b.order || 99)); // Sort by 'order' field if present
                setFleet(fetchedFleet);
                console.log("Fleet fetched:", fetchedFleet);
            }, (error) => {
                console.error("Error fetching fleet:", error);
                showTemporaryMessage('error', 'Failed to load fleet data.');
            });

            return () => unsubscribe();
        }, [db, isAuthReady]);


        return (
            <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
                {/* Hero Section */}
                <section className="mb-12 p-12 bg-white rounded-xl shadow-md border border-orange-200 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-orange-100 opacity-75"></div>
                    <div className="relative z-10">
                        <h1 className="text-6xl font-extrabold text-center mb-6 text-orange-600 drop-shadow-sm animate-fade-in-down">
                            Fly with easyJet Ro-Aviation
                        </h1>
                        <p className="text-xl text-center leading-relaxed max-w-4xl mx-auto text-gray-700 mb-8">
                            Experience the thrill of virtual aviation like never before. Join our thriving Roblox community,
                            explore diverse destinations, and become part of a passionate family of aviators.
                        </p>
                        <div className="text-center mt-6">
                            <a
                                href={robloxGroupLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-10 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-white text-xl"
                            >
                                ✈️ Join Our Roblox Group
                            </a>
                        </div>
                    </div>
                </section>

                {/* Announcements Section */}
                <section className="mb-12 p-8 bg-white rounded-xl shadow-md border border-red-200">
                    <h2 className="text-4xl font-bold text-center mb-8 text-red-600 relative">
                        Latest Announcements
                        <span className="block w-24 h-1 bg-red-400 mx-auto mt-2 rounded-full"></span>
                    </h2>
                    {announcements.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {announcements.map(announcement => (
                                <div key={announcement.id} className="bg-gray-100 p-6 rounded-lg shadow-sm flex flex-col justify-between border border-gray-200 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300">
                                    <div>
                                        <h3 className="font-bold text-2xl mb-3 text-red-500">{announcement.title}</h3>
                                        <p className="text-gray-700 mb-4 text-base leading-relaxed">{announcement.message}</p>
                                        {announcement.imageUrl && (
                                            <img
                                                src={announcement.imageUrl}
                                                alt={announcement.title}
                                                className="w-full h-48 object-cover rounded-md mb-4 shadow-inner border border-gray-300"
                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/400x240/D1D5DB/4B5563?text=Announcement+Image`; }}
                                            />
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-4">
                                        🗓️ {announcement.timestamp ? new Date(announcement.timestamp.toDate()).toLocaleString() : 'No date'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 text-lg py-4">No announcements yet. Check back soon!</p>
                    )}
                </section>

                {/* Live Flight Status Section */}
                <section className="mb-12 p-8 bg-white rounded-xl shadow-md border border-yellow-200">
                    <h2 className="text-4xl font-bold text-center mb-8 text-yellow-600 relative">
                        Live Flight Status
                        <span className="block w-24 h-1 bg-yellow-400 mx-auto mt-2 rounded-full"></span>
                    </h2>
                    <div className="overflow-x-auto">
                        {liveFlights.length > 0 ? (
                            <table className="min-w-full bg-gray-100 rounded-lg shadow-sm text-left text-gray-700 border border-gray-200">
                                <thead>
                                    <tr className="bg-gray-200 text-gray-700 uppercase text-sm leading-normal rounded-t-lg">
                                        <th className="py-3 px-6 text-left rounded-tl-lg">Flight</th>
                                        <th className="py-3 px-6 text-left">Origin</th>
                                        <th className="py-3 px-6 text-left">Destination</th>
                                        <th className="py-3 px-6 text-left">Status</th>
                                        <th className="py-3 px-6 text-left rounded-tr-lg">ETA</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-600 text-lg">
                                    {liveFlights.map(flight => (
                                        <tr key={flight.id} className="border-b border-gray-300 hover:bg-gray-200 transition-colors duration-200">
                                            <td className="py-4 px-6 font-medium whitespace-nowrap">{flight.flight}</td>
                                            <td className="py-4 px-6">{flight.origin}</td>
                                            <td className="py-4 px-6">{flight.destination}</td>
                                            <td className="py-4 px-6">
                                                <span className={`py-1 px-3 rounded-full text-xs font-bold
                                                    ${flight.status === 'En Route' ? 'bg-blue-200 text-blue-800' :
                                                    flight.status === 'Scheduled' ? 'bg-yellow-200 text-yellow-800' :
                                                    flight.status === 'Arrived' ? 'bg-green-200 text-green-800' :
                                                    flight.status === 'Cancelled' ? 'bg-red-200 text-red-800' :
                                                    'bg-gray-200 text-gray-800'}`}>
                                                    {flight.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">{flight.eta}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-gray-500 text-lg py-4">No live flights currently. Check back soon!</p>
                        )}
                    </div>
                    <p className="text-center text-gray-500 text-sm mt-6">
                        *Data updated in real-time by our staff.
                    </p>
                </section>

                {/* Our Values Section */}
                <section className="mb-12 p-8 bg-white rounded-xl shadow-md border border-purple-200">
                    <h2 className="text-4xl font-bold text-center mb-8 text-purple-600 relative">
                        Our Core Values
                        <span className="block w-24 h-1 bg-purple-400 mx-auto mt-2 rounded-full"></span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-center">
                        <div className="p-6 bg-gray-100 rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300">
                            <div className="text-5xl text-purple-500 mb-4 flex justify-center items-center h-16 w-16 mx-auto rounded-full bg-purple-100">✈️</div>
                            <h3 className="font-bold text-2xl mb-2 text-gray-800">Safety First</h3>
                            <p className="text-gray-600">Committed to the highest standards of safety in all operations.</p>
                        </div>
                        <div className="p-6 bg-gray-100 rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300">
                            <div className="text-5xl text-purple-500 mb-4 flex justify-center items-center h-16 w-16 mx-auto rounded-full bg-purple-100">🌟</div>
                            <h3 className="font-bold text-2xl mb-2 text-gray-800">Passenger Focus</h3>
                            <p className="text-gray-600">Providing an enjoyable and efficient experience for every virtual traveler.</p>
                        </div>
                        <div className="p-6 bg-gray-100 rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300">
                            <div className="text-5xl text-purple-500 mb-4 flex justify-center items-center h-16 w-16 mx-auto rounded-full bg-purple-100">🤝</div>
                            <h3 className="font-bold text-2xl mb-2 text-gray-800">Teamwork</h3>
                            <p className="text-gray-600">Working together to achieve excellence and foster a supportive community.</p>
                        </div>
                    </div>
                </section>


                <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Staff Team - Now dynamic */}
                    <div className="p-8 bg-white rounded-xl shadow-md border border-purple-200">
                        <h2 className="text-4xl font-bold mb-6 text-purple-600 relative text-center">
                            Our Staff Team
                            <span className="block w-24 h-1 bg-purple-400 mx-auto mt-2 rounded-full"></span>
                        </h2>
                        {staffTeam.length > 0 ? (
                            <div className="grid grid-cols-2 gap-6">
                                {staffTeam.map(staff => (
                                    <div key={staff.id} className="text-center p-4 bg-gray-100 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transform hover:scale-105 transition-all duration-300">
                                        <img
                                            src={staff.imageUrl || `https://placehold.co/120x120/F0F0F0/555555?text=${staff.name.split(' ')[0]}`}
                                            alt={staff.name}
                                            className="rounded-full mx-auto mb-3 shadow-sm border-2 border-purple-300 object-cover h-24 w-24"
                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/120x120/F0F0F0/555555?text=${staff.name.split(' ')[0]}`; }}
                                        />
                                        <h3 className="font-semibold text-lg text-gray-800">{staff.name}</h3>
                                        <p className="text-sm text-gray-500">{staff.role}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 text-lg py-4">No staff members listed yet.</p>
                        )}
                    </div>

                    {/* Fleet Information - Now dynamic */}
                    <div className="p-8 bg-white rounded-xl shadow-md border border-teal-200">
                        <h2 className="text-4xl font-bold mb-6 text-teal-600 relative text-center">
                            Our Fleet
                            <span className="block w-24 h-1 bg-teal-400 mx-auto mt-2 rounded-full"></span>
                        </h2>
                        {fleet.length > 0 ? (
                            <div className="space-y-6">
                                {fleet.map(aircraft => (
                                    <div key={aircraft.id} className="flex items-center space-x-4 bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transform hover:scale-105 transition-all duration-300">
                                        <img
                                            src={aircraft.imageUrl || `https://placehold.co/80x50/D1FAE5/10B981?text=${aircraft.type}`}
                                            alt={aircraft.type}
                                            className="rounded-md object-cover w-20 h-12"
                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x50/D1FAE5/10B981?text=${aircraft.type}`; }}
                                        />
                                        <div>
                                            <h3 className="font-semibold text-xl text-gray-800">{aircraft.type}</h3>
                                            <p className="text-gray-600 text-sm">{aircraft.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 text-lg py-4">No fleet information available yet.</p>
                        )}
                    </div>
                </section>

                {/* Destinations Section */}
                <section className="mb-12 p-8 bg-white rounded-xl shadow-md border border-blue-200">
                    <h2 className="text-4xl font-bold text-center mb-8 text-blue-600 relative">
                        Popular Destinations
                        <span className="block w-24 h-1 bg-blue-400 mx-auto mt-2 rounded-full"></span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-6 bg-gray-100 rounded-lg shadow-sm transform hover:scale-105 transition-transform duration-300 border border-gray-200">
                            <h3 className="font-semibold text-2xl text-center mb-2 text-blue-500">London Gatwick (LGW)</h3>
                            <p className="text-gray-600 text-center text-base mb-4">Our main hub, connecting you to the world.</p>
                            <img src={`https://placehold.co/300x180/BFDBFE/3B82F6?text=London+Cityscape`} alt="London" className="mt-4 rounded-md shadow-inner w-full object-cover h-40" />
                        </div>
                        <div className="p-6 bg-gray-100 rounded-lg shadow-sm transform hover:scale-105 transition-transform duration-300 border border-gray-200">
                            <h3 className="font-semibold text-2xl text-center mb-2 text-blue-500">Amsterdam Schiphol (AMS)</h3>
                            <p className="text-gray-600 text-center text-base mb-4">Explore the vibrant capital of the Netherlands.</p>
                            <img src={`https://placehold.co/300x180/93C5FD/2563EB?text=Amsterdam+Canals`} alt="Amsterdam" className="mt-4 rounded-md shadow-inner w-full object-cover h-40" />
                        </div>
                        <div className="p-6 bg-gray-100 rounded-lg shadow-sm transform hover:scale-105 transition-transform duration-300 border border-gray-200">
                            <h3 className="font-semibold text-2xl text-center mb-2 text-blue-500">Barcelona El Prat (BCN)</h3>
                            <p className="text-gray-600 text-center text-base mb-4">Sun, sea, and culture in Catalonia.</p>
                            <img src={`https://placehold.co/300x180/60A5FA/1D4ED8?text=Barcelona+Beach`} alt="Barcelona" className="mt-4 rounded-md shadow-inner w-full object-cover h-40" />
                        </div>
                    </div>
                </section>
            </div>
        );
    };

    // Booking Page Component
    const BookingPage = () => {
        const [formData, setFormData] = useState({
            discordUser: '',
            robloxUser: '',
            from: '',
            to: '',
            date: ''
        });
        const [isBookingSuccessful, setIsBookingSuccessful] = useState(false);
        const [isLoading, setIsLoading] = useState(false);


        const handleChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsLoading(true); // Set loading state

            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                console.error("Firestore not ready or user not authenticated for booking.");
                setIsLoading(false);
                return;
            }

            try {
                const bookingRequestsCollectionRef = collection(db, `artifacts/${appId}/public/data/bookingRequests`);
                await addDoc(bookingRequestsCollectionRef, {
                    ...formData,
                    timestamp: serverTimestamp(),
                    userId: auth.currentUser.uid, // Store the user's ID who made the booking request
                });

                setIsBookingSuccessful(true);
                showTemporaryMessage('success', 'Your booking request has been sent! We will contact you via Discord.');
                setFormData({ discordUser: '', robloxUser: '', from: '', to: '', date: '' }); // Reset form
            } catch (error) {
                console.error('Error sending booking request to Firestore:', error);
                showTemporaryMessage('error', `Failed to send booking request: ${error.message}`);
            } finally {
                setIsLoading(false); // End loading state
                setTimeout(() => {
                    setIsBookingSuccessful(false);
                }, 3000);
            }
        };

        return (
            <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
                <h2 className="text-5xl font-bold text-center mb-8 text-orange-600">Book Your Flight</h2>
                <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-md border border-orange-200">
                    {isBookingSuccessful && !isLoading ? (
                        <div className="text-center text-green-600 text-3xl font-bold animate-bounce">
                            Booking Request Sent! Thank you!
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="discordUser" className="block text-lg font-medium text-gray-700 mb-2">Your Discord User:</label>
                                <input
                                    type="text"
                                    id="discordUser"
                                    name="discordUser"
                                    value={formData.discordUser}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                                    placeholder="e.g., YourUsername#1234"
                                />
                            </div>
                            <div>
                                <label htmlFor="robloxUser" className="block text-lg font-medium text-gray-700 mb-2">Your Roblox User:</label>
                                <input
                                    type="text"
                                    id="robloxUser"
                                    name="robloxUser"
                                    value={formData.robloxUser}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                                    placeholder="e.g., YourRobloxUsername"
                                />
                            </div>
                            <div>
                                <label htmlFor="from" className="block text-lg font-medium text-gray-700 mb-2">From:</label>
                                <input
                                    type="text"
                                    id="from"
                                    name="from"
                                    value={formData.from}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                                    placeholder="e.g., London Gatwick (LGW)"
                                />
                            </div>
                            <div>
                                <label htmlFor="to" className="block text-lg font-medium text-gray-700 mb-2">To:</label>
                                <input
                                    type="text"
                                    id="to"
                                    name="to"
                                    value={formData.to}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                                    placeholder="e.g., Amsterdam Schiphol (AMS)"
                                />
                            </div>
                            <div>
                                <label htmlFor="date" className="block text-lg font-medium text-gray-700 mb-2">Departure Date:</label>
                                <input
                                    type="date"
                                    id="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Sending...' : 'Submit Booking Request'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    };

    // Staff Login Page Component
    const StaffLoginPage = ({ onLoginSuccess }) => {
        const [password, setPassword] = useState('');
        const [error, setError] = useState('');

        const handleLogin = (e) => {
            e.preventDefault();
            // Simple mock authentication for demonstration
            if (password === 'easyjetstaff2025!') { // Example password
                onLoginSuccess();
                showTemporaryMessage('success', 'Staff login successful!');
            } else {
                setError('Invalid password. Please try again.');
                showTemporaryMessage('error', 'Login failed: Invalid password.');
            }
        };

        return (
            <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
                <h2 className="text-5xl font-bold text-center mb-8 text-orange-600">Staff Login</h2>
                <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-md border border-orange-200">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="staffPassword" className="block text-lg font-medium text-gray-700 mb-2">Staff Password:</label>
                            <input
                                type="password"
                                id="staffPassword"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                                placeholder="Enter staff password"
                            />
                        </div>
                        {error && <p className="text-red-500 text-center text-sm">{error}</p>}
                        <button
                            type="submit"
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-50"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    // --- Staff Dashboard Sub-Components ---
    // These components are declared only once now.
    const StaffAnnouncementsManager = ({ db, appId, auth, showTemporaryMessage, confirmDeleteItem }) => {
        const [announcements, setAnnouncements] = useState([]);
        const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', imageUrl: '' });
        const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

        useEffect(() => {
            if (!db || !auth.currentUser) return;
            const announcementsCollectionRef = collection(db, `artifacts/${appId}/public/data/announcements`);
            const unsubscribe = onSnapshot(announcementsCollectionRef, (snapshot) => {
                const fetchedAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
                setAnnouncements(fetchedAnnouncements);
            }, (error) => {
                console.error("Error fetching announcements:", error);
                showTemporaryMessage('error', 'Failed to load announcements.');
            });
            return () => unsubscribe();
        }, [db, appId, auth, showTemporaryMessage]);

        const handleAnnouncementChange = (e) => {
            const { name, value } = e.target;
            setNewAnnouncement(prev => ({ ...prev, [name]: value }));
        };

        const handleAddOrUpdateAnnouncement = async (e) => {
            e.preventDefault();
            if (!newAnnouncement.title || !newAnnouncement.message) {
                showTemporaryMessage('error', 'Title and Message are required.');
                return;
            }
            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                return;
            }

            try {
                const announcementsCollectionRef = collection(db, `artifacts/${appId}/public/data/announcements`);
                const announcementData = { ...newAnnouncement, timestamp: serverTimestamp(), authorId: auth.currentUser.uid };
                if (editingAnnouncementId) {
                    await updateDoc(doc(announcementsCollectionRef, editingAnnouncementId), announcementData);
                    showTemporaryMessage('success', 'Announcement updated successfully!');
                    setEditingAnnouncementId(null);
                } else {
                    await addDoc(announcementsCollectionRef, announcementData);
                    showTemporaryMessage('success', 'Announcement added successfully!');
                }
                setNewAnnouncement({ title: '', message: '', imageUrl: '' });
            } catch (error) {
                console.error("Error adding/updating announcement:", error);
                showTemporaryMessage('error', `Failed to add/update announcement: ${error.message}`);
            }
        };

        const handleEditAnnouncement = (announcement) => {
            setNewAnnouncement({ title: announcement.title, message: announcement.message, imageUrl: announcement.imageUrl || '' });
            setEditingAnnouncementId(announcement.id);
        };

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-red-500">Manage Announcements</h3>
                <form onSubmit={handleAddOrUpdateAnnouncement} className="space-y-6 mb-10 p-6 bg-gray-100 rounded-xl shadow-md border border-gray-200">
                    <div>
                        <label htmlFor="announcementTitle" className="block text-lg font-medium text-gray-700 mb-2">Title:</label>
                        <input type="text" id="announcementTitle" name="title" value={newAnnouncement.title} onChange={handleAnnouncementChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200" placeholder="Enter announcement title" />
                    </div>
                    <div>
                        <label htmlFor="announcementMessage" className="block text-lg font-medium text-gray-700 mb-2">Message:</label>
                        <textarea id="announcementMessage" name="message" value={newAnnouncement.message} onChange={handleAnnouncementChange} required rows="4" className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200" placeholder="Enter announcement message"></textarea>
                    </div>
                    <div>
                        <label htmlFor="announcementImageUrl" className="block text-lg font-medium text-gray-700 mb-2">Image URL (Optional):</label>
                        <input type="url" id="announcementImageUrl" name="imageUrl" value={newAnnouncement.imageUrl} onChange={handleAnnouncementChange} className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200" placeholder="e.g., https://example.com/image.jpg" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            {editingAnnouncementId ? 'Update Announcement' : 'Add Announcement'}
                        </button>
                    </div>
                    {editingAnnouncementId && (
                        <button type="button" onClick={() => { setNewAnnouncement({ title: '', message: '', imageUrl: '' }); setEditingAnnouncementId(null); }} className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            Cancel Edit
                        </button>
                    )}
                </form>

                <h3 className="text-3xl font-bold mb-6 text-red-500">Existing Announcements</h3>
                {announcements.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {announcements.map(announcement => (
                            <div key={announcement.id} className="bg-gray-100 p-6 rounded-xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center border border-gray-200">
                                <div className="flex-grow">
                                    <h4 className="font-bold text-2xl mb-2 text-red-500">{announcement.title}</h4>
                                    <p className="text-gray-700 mb-2">{announcement.message}</p>
                                    {announcement.imageUrl && (<img src={announcement.imageUrl} alt={announcement.title} className="w-full sm:w-48 h-32 object-cover rounded-lg mb-2 sm:mb-0 shadow-inner" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/200x120/D1D5DB/4B5563?text=Image+Not+Found`; }} />)}
                                    <p className="text-sm text-gray-500 mt-2">Posted: {announcement.timestamp ? new Date(announcement.timestamp.toDate()).toLocaleString() : 'No date'}</p>
                                </div>
                                <div className="flex space-x-2 mt-4 sm:mt-0">
                                    <button onClick={() => handleEditAnnouncement(announcement)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transform hover:scale-105 transition-all duration-300">Edit</button>
                                    <button onClick={() => confirmDeleteItem(announcement.id, 'announcement')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transform hover:scale-105 transition-all duration-300">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No announcements available to manage.</p>)}
            </div>
        );
    };

    const StaffLiveFlightsManager = ({ db, appId, auth, showTemporaryMessage, confirmDeleteItem }) => {
        const [liveFlights, setLiveFlights] = useState([]);
        const [newLiveFlight, setNewLiveFlight] = useState({ flight: '', origin: '', destination: '', status: 'Scheduled', eta: '' });
        const [editingLiveFlightId, setEditingLiveFlightId] = useState(null);

        useEffect(() => {
            if (!db || !auth.currentUser) return;
            const liveFlightsCollectionRef = collection(db, `artifacts/${appId}/public/data/liveFlights`);
            const unsubscribe = onSnapshot(liveFlightsCollectionRef, (snapshot) => {
                const fetchedLiveFlights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
                setLiveFlights(fetchedLiveFlights);
            }, (error) => {
                console.error("Error fetching live flights:", error);
                showTemporaryMessage('error', 'Failed to load live flights.');
            });
            return () => unsubscribe();
        }, [db, appId, auth, showTemporaryMessage]);

        const handleLiveFlightChange = (e) => {
            const { name, value } = e.target;
            setNewLiveFlight(prev => ({ ...prev, [name]: value }));
        };

        const handleAddOrUpdateLiveFlight = async (e) => {
            e.preventDefault();
            if (!newLiveFlight.flight || !newLiveFlight.origin || !newLiveFlight.destination || !newLiveFlight.status) {
                showTemporaryMessage('error', 'Flight, Origin, Destination, and Status are required.');
                return;
            }
            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                return;
            }

            try {
                const liveFlightsCollectionRef = collection(db, `artifacts/${appId}/public/data/liveFlights`);
                const liveFlightData = { ...newLiveFlight, timestamp: serverTimestamp(), lastUpdatedBy: auth.currentUser.uid };
                if (editingLiveFlightId) {
                    await updateDoc(doc(liveFlightsCollectionRef, editingLiveFlightId), liveFlightData);
                    showTemporaryMessage('success', 'Live flight updated successfully!');
                    setEditingLiveFlightId(null);
                } else {
                    await addDoc(liveFlightsCollectionRef, liveFlightData);
                    showTemporaryMessage('success', 'Live flight added successfully!');
                }
                setNewLiveFlight({ flight: '', origin: '', destination: '', status: 'Scheduled', eta: '' });
            } catch (error) {
                console.error("Error adding/updating live flight:", error);
                showTemporaryMessage('error', `Failed to add/update live flight: ${error.message}`);
            }
        };

        const handleEditLiveFlight = (flight) => {
            setNewLiveFlight({ flight: flight.flight, origin: flight.origin, destination: flight.destination, status: flight.status, eta: flight.eta || '' });
            setEditingLiveFlightId(flight.id);
        };

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-yellow-600">Manage Live Flights</h3>
                <form onSubmit={handleAddOrUpdateLiveFlight} className="space-y-6 mb-10 p-6 bg-gray-100 rounded-xl shadow-md border border-gray-200">
                    <div>
                        <label htmlFor="flightNumber" className="block text-lg font-medium text-gray-700 mb-2">Flight Number:</label>
                        <input type="text" id="flightNumber" name="flight" value={newLiveFlight.flight} onChange={handleLiveFlightChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-200" placeholder="e.g., EZY123" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="origin" className="block text-lg font-medium text-gray-700 mb-2">Origin (ICAO):</label>
                            <input type="text" id="origin" name="origin" value={newLiveFlight.origin} onChange={handleLiveFlightChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-200" placeholder="e.g., LGW" />
                        </div>
                        <div>
                            <label htmlFor="destination" className="block text-lg font-medium text-gray-700 mb-2">Destination (ICAO):</label>
                            <input type="text" id="destination" name="destination" value={newLiveFlight.destination} onChange={handleLiveFlightChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-200" placeholder="e.g., AMS" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="status" className="block text-lg font-medium text-gray-700 mb-2">Status:</label>
                            <select id="status" name="status" value={newLiveFlight.status} onChange={handleLiveFlightChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-200">
                                <option value="Scheduled">Scheduled</option>
                                <option value="Departed">Departed</option>
                                <option value="En Route">En Route</option>
                                <option value="Arrived">Arrived</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Delayed">Delayed</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="eta" className="block text-lg font-medium text-gray-700 mb-2">ETA / Actual Time (Optional):</label>
                            <input type="text" id="eta" name="eta" value={newLiveFlight.eta} onChange={handleLiveFlightChange} className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all duration-200" placeholder="e.g., 1h 30m / 14:30 GMT" />
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            {editingLiveFlightId ? 'Update Live Flight' : 'Add Live Flight'}
                        </button>
                    </div>
                    {editingLiveFlightId && (
                        <button type="button" onClick={() => { setNewLiveFlight({ flight: '', origin: '', destination: '', status: 'Scheduled', eta: '' }); setEditingLiveFlightId(null); }} className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            Cancel Edit
                        </button>
                    )}
                </form>

                <h3 className="text-3xl font-bold mb-6 text-yellow-600">Current Live Flights</h3>
                {liveFlights.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-gray-100 rounded-xl shadow-md text-left text-gray-700 border border-gray-200">
                            <thead>
                                <tr className="bg-gray-200 text-gray-700 uppercase text-sm leading-normal">
                                    <th className="py-3 px-6 text-left">Flight</th>
                                    <th className="py-3 px-6 text-left">Origin</th>
                                    <th className="py-3 px-6 text-left">Destination</th>
                                    <th className="py-3 px-6 text-left">Status</th>
                                    <th className="py-3 px-6 text-left">ETA/Time</th>
                                    <th className="py-3 px-6 text-left">Last Updated</th>
                                    <th className="py-3 px-6 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600 text-sm">
                                {liveFlights.map(flight => (
                                    <tr key={flight.id} className="border-b border-gray-300 hover:bg-gray-200 transition-colors duration-200">
                                        <td className="py-4 px-6 font-medium whitespace-nowrap">{flight.flight}</td>
                                        <td className="py-4 px-6">{flight.origin}</td>
                                        <td className="py-4 px-6">{flight.destination}</td>
                                        <td className="py-4 px-6">
                                            <span className={`py-1 px-3 rounded-full text-xs font-bold
                                                ${flight.status === 'En Route' ? 'bg-blue-200 text-blue-800' :
                                                flight.status === 'Scheduled' ? 'bg-yellow-200 text-yellow-800' :
                                                flight.status === 'Arrived' ? 'bg-green-200 text-green-800' :
                                                flight.status === 'Cancelled' ? 'bg-red-200 text-red-800' :
                                                'bg-gray-200 text-gray-800'}`}>
                                                {flight.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">{flight.eta || 'N/A'}</td>
                                        <td className="py-4 px-6">{flight.timestamp ? new Date(flight.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                                        <td className="py-4 px-6 flex space-x-2">
                                            <button onClick={() => handleEditLiveFlight(flight)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-xs transform hover:scale-105 transition-all duration-300">Edit</button>
                                            <button onClick={() => confirmDeleteItem(flight.id, 'liveFlight')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-xs transform hover:scale-105 transition-all duration-300">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No live flights available to manage.</p>)}
            </div>
        );
    };

    const StaffPhotoAlbumManager = ({ db, appId, auth, showTemporaryMessage, confirmDeleteItem }) => {
        const [photos, setPhotos] = useState([]);
        const [newPhoto, setNewPhoto] = useState({ src: '', title: '', description: '' });
        const [editingPhotoId, setEditingPhotoId] = useState(null);

        useEffect(() => {
            if (!db || !auth.currentUser) return;
            const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
            const unsubscribe = onSnapshot(photosCollectionRef, (snapshot) => {
                const fetchedPhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
                setPhotos(fetchedPhotos);
            }, (error) => {
                console.error("Error fetching photos:", error);
                showTemporaryMessage('error', 'Failed to load photos.');
            });
            return () => unsubscribe();
        }, [db, appId, auth, showTemporaryMessage]);

        const handlePhotoChange = (e) => {
            const { name, value } = e.target;
            setNewPhoto(prev => ({ ...prev, [name]: value }));
        };

        const handleAddOrUpdatePhoto = async (e) => {
            e.preventDefault();
            if (!newPhoto.src || !newPhoto.title || !newPhoto.description) {
                showTemporaryMessage('error', 'Image URL, Title, and Description are required.');
                return;
            }
            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                return;
            }

            try {
                const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
                const photoData = { ...newPhoto, timestamp: serverTimestamp(), uploadedBy: auth.currentUser.uid };
                if (editingPhotoId) {
                    await updateDoc(doc(photosCollectionRef, editingPhotoId), photoData);
                    showTemporaryMessage('success', 'Photo updated successfully!');
                    setEditingPhotoId(null);
                } else {
                    await addDoc(photosCollectionRef, photoData);
                    showTemporaryMessage('success', 'Photo added successfully!');
                }
                setNewPhoto({ src: '', title: '', description: '' });
            } catch (error) {
                console.error("Error adding/updating photo:", error);
                showTemporaryMessage('error', `Failed to add/update photo: ${error.message}`);
            }
        };

        const handleEditPhoto = (photo) => {
            setNewPhoto({ src: photo.src, title: photo.title, description: photo.description });
            setEditingPhotoId(photo.id);
        };

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-teal-600">Manage Photo Album</h3>
                <form onSubmit={handleAddOrUpdatePhoto} className="space-y-6 mb-10 p-6 bg-gray-100 rounded-xl shadow-md border border-gray-200">
                    <div>
                        <label htmlFor="photoTitle" className="block text-lg font-medium text-gray-700 mb-2">Photo Title:</label>
                        <input type="text" id="photoTitle" name="title" value={newPhoto.title} onChange={handlePhotoChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="e.g., Sunset Landing in Amsterdam" />
                    </div>
                    <div>
                        <label htmlFor="photoSrc" className="block text-lg font-medium text-gray-700 mb-2">Image URL:</label>
                        <input type="url" id="photoSrc" name="src" value={newPhoto.src} onChange={handlePhotoChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="e.g., https://example.com/sunset_flight.jpg" />
                    </div>
                    <div>
                        <label htmlFor="photoDescription" className="block text-lg font-medium text-gray-700 mb-2">Description:</label>
                        <textarea id="photoDescription" name="description" value={newPhoto.description} onChange={handlePhotoChange} required rows="4" className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="Write a short description for the photo..."></textarea>
                    </div>
                    <button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                        {editingPhotoId ? 'Update Photo' : 'Add Photo'}
                    </button>
                    {editingPhotoId && (
                        <button type="button" onClick={() => { setNewPhoto({ src: '', title: '', description: '' }); setEditingPhotoId(null); }} className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            Cancel Edit
                        </button>
                    )}
                </form>

                <h3 className="text-3xl font-bold mb-6 text-teal-600">Existing Photos</h3>
                {photos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {photos.map(photo => (
                            <div key={photo.id} className="bg-gray-100 p-6 rounded-xl shadow-md flex flex-col justify-between border border-gray-200">
                                <div>
                                    <img src={photo.src} alt={photo.title} className="w-full h-48 object-cover rounded-lg mb-4 shadow-inner" onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/400x240/D1D5DB/4B5563?text=Image+Not+Found`; }} />
                                    <h4 className="font-bold text-2xl mb-2 text-teal-500">{photo.title}</h4>
                                    <p className="text-gray-700 mb-2 text-sm">{photo.description}</p>
                                </div>
                                <div className="flex space-x-2 mt-4">
                                    <button onClick={() => handleEditPhoto(photo)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md text-sm transform hover:scale-105 transition-all duration-300">Edit</button>
                                    <button onClick={() => confirmDeleteItem(photo.id, 'photo')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md text-sm transform hover:scale-105 transition-all duration-300">Delete</button>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">Uploaded: {photo.timestamp ? new Date(photo.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No photos available to manage.</p>)}
            </div>
        );
    };

    const StaffBookingRequestsManager = ({ db, appId, showTemporaryMessage, confirmDeleteItem }) => {
        const [bookingRequests, setBookingRequests] = useState([]);

        useEffect(() => {
            if (!db) return;
            const bookingRequestsCollectionRef = collection(db, `artifacts/${appId}/public/data/bookingRequests`);
            const unsubscribe = onSnapshot(bookingRequestsCollectionRef, (snapshot) => {
                const fetchedBookingRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
                setBookingRequests(fetchedBookingRequests);
            }, (error) => {
                console.error("Error fetching booking requests:", error);
                showTemporaryMessage('error', 'Failed to load booking requests.');
            });
            return () => unsubscribe();
        }, [db, appId, showTemporaryMessage]);

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-yellow-600">Manage Booking Requests</h3>
                {bookingRequests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-gray-100 rounded-xl shadow-md text-left text-gray-700 border border-gray-200">
                            <thead>
                                <tr className="bg-gray-200 text-gray-700 uppercase text-sm leading-normal">
                                    <th className="py-3 px-6 text-left">Discord User</th>
                                    <th className="py-3 px-6 text-left">Roblox User</th>
                                    <th className="py-3 px-6 text-left">From</th>
                                    <th className="py-3 px-6 text-left">To</th>
                                    <th className="py-3 px-6 text-left">Date</th>
                                    <th className="py-3 px-6 text-left">Submitted</th>
                                    <th className="py-3 px-6 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600 text-sm">
                                {bookingRequests.map(request => (
                                    <tr key={request.id} className="border-b border-gray-300 hover:bg-gray-200 transition-colors duration-200">
                                        <td className="py-4 px-6">{request.discordUser}</td>
                                        <td className="py-4 px-6">{request.robloxUser}</td>
                                        <td className="py-4 px-6">{request.from}</td>
                                        <td className="py-4 px-6">{request.to}</td>
                                        <td className="py-4 px-6">{request.date}</td>
                                        <td className="py-4 px-6">{request.timestamp ? new Date(request.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                                        <td className="py-4 px-6">
                                            <button onClick={() => confirmDeleteItem(request.id, 'booking')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-xs transform hover:scale-105 transition-all duration-300">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No booking requests available.</p>)}
            </div>
        );
    };

    const StaffSupportRequestsManager = ({ db, appId, showTemporaryMessage, confirmDeleteItem }) => {
        const [supportRequests, setSupportRequests] = useState([]);

        useEffect(() => {
            if (!db) return;
            const supportRequestsCollectionRef = collection(db, `artifacts/${appId}/public/data/supportRequests`);
            const unsubscribe = onSnapshot(supportRequestsCollectionRef, (snapshot) => {
                const fetchedSupportRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
                setSupportRequests(fetchedSupportRequests);
            }, (error) => {
                console.error("Error fetching support requests:", error);
                showTemporaryMessage('error', 'Failed to load support requests.');
            });
            return () => unsubscribe();
        }, [db, appId, showTemporaryMessage]);

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-green-600">Manage Support Requests</h3>
                {supportRequests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-gray-100 rounded-xl shadow-md text-left text-gray-700 border border-gray-200">
                            <thead>
                                <tr className="bg-gray-200 text-gray-700 uppercase text-sm leading-normal">
                                    <th className="py-3 px-6 text-left">Discord User</th>
                                    <th className="py-3 px-6 text-left">Roblox User</th>
                                    <th className="py-3 px-6 text-left">Subject</th>
                                    <th className="py-3 px-6 text-left">Message</th>
                                    <th className="py-3 px-6 text-left">Submitted</th>
                                    <th className="py-3 px-6 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-600 text-sm">
                                {supportRequests.map(request => (
                                    <tr key={request.id} className="border-b border-gray-300 hover:bg-gray-200 transition-colors duration-200">
                                        <td className="py-4 px-6">{request.discordUser}</td>
                                        <td className="py-4 px-6">{request.robloxUser}</td>
                                        <td className="py-4 px-6">{request.subject}</td>
                                        <td className="py-4 px-6 max-w-xs overflow-hidden text-ellipsis">{request.message}</td>
                                        <td className="py-4 px-6">{request.timestamp ? new Date(request.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                                        <td className="py-4 px-6">
                                            <button onClick={() => confirmDeleteItem(request.id, 'support')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-xs transform hover:scale-105 transition-all duration-300">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No support requests available.</p>)}
            </div>
        );
    };

    // Staff Team Manager Component
    const StaffTeamManager = ({ db, appId, auth, showTemporaryMessage, confirmDeleteItem }) => {
        const [staffMembers, setStaffMembers] = useState([]);
        const [newStaffMember, setNewStaffMember] = useState({ name: '', role: '', imageUrl: '', order: '' });
        const [editingStaffId, setEditingStaffId] = useState(null);

        useEffect(() => {
            if (!db || !auth.currentUser) return;
            const staffCollectionRef = collection(db, `artifacts/${appId}/public/data/staffTeam`);
            const unsubscribe = onSnapshot(staffCollectionRef, (snapshot) => {
                const fetchedStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.order || 999) - (b.order || 999));
                setStaffMembers(fetchedStaff);
            }, (error) => {
                console.error("Error fetching staff:", error);
                showTemporaryMessage('error', 'Failed to load staff members.');
            });
            return () => unsubscribe();
        }, [db, appId, auth, showTemporaryMessage]);

        const handleStaffChange = (e) => {
            const { name, value } = e.target;
            setNewStaffMember(prev => ({
                ...prev,
                [name]: name === 'order' ? (value === '' ? '' : parseInt(value)) : value
            }));
        };

        const handleAddOrUpdateStaff = async (e) => {
            e.preventDefault();
            if (!newStaffMember.name || !newStaffMember.role) {
                showTemporaryMessage('error', 'Name and Role are required for staff members.');
                return;
            }
            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                return;
            }

            try {
                const staffCollectionRef = collection(db, `artifacts/${appId}/public/data/staffTeam`);
                const staffData = { ...newStaffMember, timestamp: serverTimestamp(), lastUpdatedBy: auth.currentUser.uid };
                if (editingStaffId) {
                    await updateDoc(doc(staffCollectionRef, editingStaffId), staffData);
                    showTemporaryMessage('success', 'Staff member updated successfully!');
                    setEditingStaffId(null);
                } else {
                    await addDoc(staffCollectionRef, staffData);
                    showTemporaryMessage('success', 'Staff member added successfully!');
                }
                setNewStaffMember({ name: '', role: '', imageUrl: '', order: '' });
            } catch (error) {
                console.error("Error adding/updating staff member:", error);
                showTemporaryMessage('error', `Failed to add/update staff member: ${error.message}`);
            }
        };

        const handleEditStaff = (staff) => {
            setNewStaffMember({ name: staff.name, role: staff.role, imageUrl: staff.imageUrl || '', order: staff.order || '' });
            setEditingStaffId(staff.id);
        };

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-purple-600">Manage Staff Team</h3>
                <form onSubmit={handleAddOrUpdateStaff} className="space-y-6 mb-10 p-6 bg-gray-100 rounded-xl shadow-md border border-gray-200">
                    <div>
                        <label htmlFor="staffName" className="block text-lg font-medium text-gray-700 mb-2">Name:</label>
                        <input type="text" id="staffName" name="name" value={newStaffMember.name} onChange={handleStaffChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200" placeholder="e.g., Jane Doe" />
                    </div>
                    <div>
                        <label htmlFor="staffRole" className="block text-lg font-medium text-gray-700 mb-2">Role:</label>
                        <input type="text" id="staffRole" name="role" value={newStaffMember.role} onChange={handleStaffChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200" placeholder="e.g., Senior Pilot" />
                    </div>
                    <div>
                        <label htmlFor="staffImageUrl" className="block text-lg font-medium text-gray-700 mb-2">Image URL (Optional):</label>
                        <input type="url" id="staffImageUrl" name="imageUrl" value={newStaffMember.imageUrl} onChange={handleStaffChange} className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200" placeholder="e.g., https://example.com/jane_doe.jpg" />
                    </div>
                    <div>
                        <label htmlFor="staffOrder" className="block text-lg font-medium text-gray-700 mb-2">Display Order (Lower is first):</label>
                        <input type="number" id="staffOrder" name="order" value={newStaffMember.order} onChange={handleStaffChange} className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200" placeholder="e.g., 1, 2, 3..." min="0" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button type="submit" className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            {editingStaffId ? 'Update Staff Member' : 'Add Staff Member'}
                        </button>
                    </div>
                    {editingStaffId && (
                        <button type="button" onClick={() => { setNewStaffMember({ name: '', role: '', imageUrl: '', order: '' }); setEditingStaffId(null); }} className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            Cancel Edit
                        </button>
                    )}
                </form>

                <h3 className="text-3xl font-bold mb-6 text-purple-600">Current Staff Members</h3>
                {staffMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {staffMembers.map(staff => (
                            <div key={staff.id} className="bg-gray-100 p-6 rounded-xl shadow-md flex items-center space-x-4 border border-gray-200">
                                <img
                                    src={staff.imageUrl || `https://placehold.co/80x80/F0F0F0/555555?text=${staff.name.split(' ')[0]}`}
                                    alt={staff.name}
                                    className="rounded-full w-20 h-20 object-cover border-2 border-purple-300"
                                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/F0F0F0/555555?text=${staff.name.split(' ')[0]}`; }}
                                />
                                <div className="flex-grow">
                                    <h4 className="font-bold text-xl text-purple-500">{staff.name}</h4>
                                    <p className="text-gray-700 text-base">{staff.role}</p>
                                    <p className="text-sm text-gray-500">Order: {staff.order || 'N/A'}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => handleEditStaff(staff)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-sm transform hover:scale-105 transition-all duration-300">Edit</button>
                                    <button onClick={() => confirmDeleteItem(staff.id, 'staff')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-sm transform hover:scale-105 transition-all duration-300">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No staff members available to manage.</p>)}
            </div>
        );
    };

    // New Fleet Manager Component
    const StaffFleetManager = ({ db, appId, auth, showTemporaryMessage, confirmDeleteItem }) => {
        const [fleet, setFleet] = useState([]);
        const [newAircraft, setNewAircraft] = useState({ type: '', description: '', imageUrl: '', order: '' });
        const [editingAircraftId, setEditingAircraftId] = useState(null);

        useEffect(() => {
            if (!db || !auth.currentUser) return;
            const fleetCollectionRef = collection(db, `artifacts/${appId}/public/data/fleet`);
            const unsubscribe = onSnapshot(fleetCollectionRef, (snapshot) => {
                const fetchedFleet = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.order || 999) - (b.order || 999));
                setFleet(fetchedFleet);
            }, (error) => {
                console.error("Error fetching fleet:", error);
                showTemporaryMessage('error', 'Failed to load fleet information.');
            });
            return () => unsubscribe();
        }, [db, appId, auth, showTemporaryMessage]);

        const handleAircraftChange = (e) => {
            const { name, value } = e.target;
            setNewAircraft(prev => ({
                ...prev,
                [name]: name === 'order' ? (value === '' ? '' : parseInt(value)) : value
            }));
        };

        const handleAddOrUpdateAircraft = async (e) => {
            e.preventDefault();
            if (!newAircraft.type || !newAircraft.description) {
                showTemporaryMessage('error', 'Aircraft Type and Description are required.');
                return;
            }
            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                return;
            }

            try {
                const fleetCollectionRef = collection(db, `artifacts/${appId}/public/data/fleet`);
                const aircraftData = { ...newAircraft, timestamp: serverTimestamp(), lastUpdatedBy: auth.currentUser.uid };
                if (editingAircraftId) {
                    await updateDoc(doc(fleetCollectionRef, editingAircraftId), aircraftData);
                    showTemporaryMessage('success', 'Aircraft updated successfully!');
                    setEditingAircraftId(null);
                } else {
                    await addDoc(fleetCollectionRef, aircraftData);
                    showTemporaryMessage('success', 'Aircraft added successfully!');
                }
                setNewAircraft({ type: '', description: '', imageUrl: '', order: '' });
            } catch (error) {
                console.error("Error adding/updating aircraft:", error);
                showTemporaryMessage('error', `Failed to add/update aircraft: ${error.message}`);
            }
        };

        const handleEditAircraft = (aircraft) => {
            setNewAircraft({ type: aircraft.type, description: aircraft.description, imageUrl: aircraft.imageUrl || '', order: aircraft.order || '' });
            setEditingAircraftId(aircraft.id);
        };

        return (
            <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6 text-teal-600">Manage Our Fleet</h3>
                <form onSubmit={handleAddOrUpdateAircraft} className="space-y-6 mb-10 p-6 bg-gray-100 rounded-xl shadow-md border border-gray-200">
                    <div>
                        <label htmlFor="aircraftType" className="block text-lg font-medium text-gray-700 mb-2">Aircraft Type:</label>
                        <input type="text" id="aircraftType" name="type" value={newAircraft.type} onChange={handleAircraftChange} required className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="e.g., Airbus A320" />
                    </div>
                    <div>
                        <label htmlFor="aircraftDescription" className="block text-lg font-medium text-gray-700 mb-2">Description:</label>
                        <textarea id="aircraftDescription" name="description" value={newAircraft.description} onChange={handleAircraftChange} required rows="4" className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="e.g., Our workhorse, perfect for short-haul flights."></textarea>
                    </div>
                    <div>
                        <label htmlFor="aircraftImageUrl" className="block text-lg font-medium text-gray-700 mb-2">Image URL (Optional):</label>
                        <input type="url" id="aircraftImageUrl" name="imageUrl" value={newAircraft.imageUrl} onChange={handleAircraftChange} className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="e.g., https://example.com/a320.png" />
                    </div>
                    <div>
                        <label htmlFor="aircraftOrder" className="block text-lg font-medium text-gray-700 mb-2">Display Order (Lower is first):</label>
                        <input type="number" id="aircraftOrder" name="order" value={newAircraft.order} onChange={handleAircraftChange} className="w-full p-3 rounded-lg bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200" placeholder="e.g., 1, 2, 3..." min="0" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button type="submit" className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            {editingAircraftId ? 'Update Aircraft' : 'Add Aircraft'}
                        </button>
                    </div>
                    {editingAircraftId && (
                        <button type="button" onClick={() => { setNewAircraft({ type: '', description: '', imageUrl: '', order: '' }); setEditingAircraftId(null); }} className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-100">
                            Cancel Edit
                        </button>
                    )}
                </form>

                <h3 className="text-3xl font-bold mb-6 text-teal-600">Current Fleet</h3>
                {fleet.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fleet.map(aircraft => (
                            <div key={aircraft.id} className="bg-gray-100 p-6 rounded-xl shadow-md flex items-center space-x-4 border border-gray-200">
                                <img
                                    src={aircraft.imageUrl || `https://placehold.co/80x50/D1FAE5/10B981?text=${aircraft.type}`}
                                    alt={aircraft.type}
                                    className="rounded-md w-20 h-12 object-cover"
                                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x50/D1FAE5/10B981?text=${aircraft.type}`; }}
                                />
                                <div>
                                    <h3 className="font-bold text-xl text-teal-500">{aircraft.type}</h3>
                                    <p className="text-gray-700 text-base">{aircraft.description}</p>
                                    <p className="text-sm text-gray-500">Order: {aircraft.order || 'N/A'}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => handleEditAircraft(aircraft)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-sm transform hover:scale-105 transition-all duration-300">Edit</button>
                                    <button onClick={() => confirmDeleteItem(aircraft.id, 'fleet')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg shadow-md text-sm transform hover:scale-105 transition-all duration-300">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (<p className="text-center text-gray-500 text-lg">No fleet information available to manage.</p>)}
            </div>
        );
    };

    // Staff Dashboard Component (all sub-components are now defined above this)
    const StaffDashboardPage = () => {
        const [selectedTab, setSelectedTab] = useState('announcements'); // Default tab

        const [showConfirmDialog, setShowConfirmDialog] = useState(false);
        const [itemToDelete, setItemToDelete] = useState(null);
        const [itemTypeToDelete, setItemTypeToDelete] = useState('');

        const confirmDeleteItem = (id, type) => {
            setItemToDelete(id);
            setItemTypeToDelete(type);
            setShowConfirmDialog(true);
        };

        const handleDeleteItem = async () => {
            setShowConfirmDialog(false);
            if (!itemToDelete || !itemTypeToDelete) return;

            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                console.error("Firestore not ready or user not authenticated for deleting item.");
                return;
            }

            try {
                let collectionPath;
                let successMessage = '';
                switch (itemTypeToDelete) {
                    case 'announcement': collectionPath = `artifacts/${appId}/public/data/announcements`; successMessage = 'Announcement deleted successfully!'; break;
                    case 'booking': collectionPath = `artifacts/${appId}/public/data/bookingRequests`; successMessage = 'Booking request deleted successfully!'; break;
                    case 'support': collectionPath = `artifacts/${appId}/public/data/supportRequests`; successMessage = 'Support request deleted successfully!'; break;
                    case 'liveFlight': collectionPath = `artifacts/${appId}/public/data/liveFlights`; successMessage = 'Live flight deleted successfully!'; break;
                    case 'photo': collectionPath = `artifacts/${appId}/public/data/photos`; successMessage = 'Photo deleted successfully!'; break;
                    case 'staff': collectionPath = `artifacts/${appId}/public/data/staffTeam`; successMessage = 'Staff member deleted successfully!'; break;
                    case 'fleet': collectionPath = `artifacts/${appId}/public/data/fleet`; successMessage = 'Aircraft deleted successfully!'; break;
                    default: console.error('Unknown item type for deletion:', itemTypeToDelete); showTemporaryMessage('error', 'Unknown item type for deletion.'); return;
                }

                const docRef = doc(db, collectionPath, itemToDelete);
                await deleteDoc(docRef);
                showTemporaryMessage('success', successMessage);
                setItemToDelete(null);
                setItemTypeToDelete('');
            } catch (error) {
                console.error(`Error deleting ${itemTypeToDelete} item:`, error);
                showTemporaryMessage('error', `Failed to delete ${itemTypeToDelete} item: ${error.message}`);
            }
        };

        // Common props to pass to child components
        const commonProps = { db, appId, auth, showTemporaryMessage, confirmDeleteItem };

        return (
            <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
                <h2 className="text-5xl font-bold text-center mb-8 text-orange-600">Staff Dashboard</h2>
                <div className="max-w-7xl mx-auto p-8 bg-white rounded-xl shadow-md border border-orange-200">
                    <div className="flex flex-wrap justify-center mb-8 gap-4">
                        <TabButton name="announcements" label="Announcements" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                        <TabButton name="liveFlights" label="Live Flights" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                        <TabButton name="photoAlbum" label="Photo Album" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                        <TabButton name="bookingRequests" label="Booking Requests" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                        <TabButton name="supportRequests" label="Support Requests" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                        <TabButton name="staffTeam" label="Staff Team" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                        <TabButton name="fleet" label="Fleet" selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                    </div>

                    <div className="mt-8">
                        {selectedTab === 'announcements' && <StaffAnnouncementsManager {...commonProps} />}
                        {selectedTab === 'liveFlights' && <StaffLiveFlightsManager {...commonProps} />}
                        {selectedTab === 'photoAlbum' && <StaffPhotoAlbumManager {...commonProps} />}
                        {selectedTab === 'bookingRequests' && <StaffBookingRequestsManager {...commonProps} />}
                        {selectedTab === 'supportRequests' && <StaffSupportRequestsManager {...commonProps} />}
                        {selectedTab === 'staffTeam' && <StaffTeamManager {...commonProps} />}
                        {selectedTab === 'fleet' && <StaffFleetManager {...commonProps} />}
                    </div>
                </div>

                {/* Confirmation Dialog */}
                {showConfirmDialog && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
                        <div className="bg-white p-8 rounded-xl shadow-2xl border border-red-500 max-w-md w-full text-center text-gray-800">
                            <p className="text-xl mb-6">Are you sure you want to delete this {itemTypeToDelete}?</p>
                            <div className="flex justify-center space-x-4">
                                <button
                                    onClick={handleDeleteItem}
                                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-5 rounded-lg shadow-md transform hover:scale-105 transition-all duration-300"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-5 rounded-lg shadow-md transform hover:scale-105 transition-all duration-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Global component declarations (defined once here)
    const TabButton = ({ name, label, selectedTab, setSelectedTab }) => (
        <button
            onClick={() => setSelectedTab(name)}
            className={`py-3 px-6 rounded-lg text-lg font-semibold transition-all duration-300 transform
                        ${selectedTab === name
                            ? 'bg-orange-500 text-white shadow-lg scale-105'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-800'}`
                        }
        >
            {label}
        </button>
    );

    const CareersPage = () => (
        <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
            <h2 className="text-5xl font-bold text-center mb-8 text-orange-600">Join Our Team</h2>
            <div className="max-w-3xl mx-auto p-8 bg-white rounded-xl shadow-md border border-purple-200">
                <p className="text-lg leading-relaxed mb-6 text-gray-700">
                    At easyJet Ro-Aviation, we're always looking for passionate individuals to join our growing team.
                    If you have a love for aviation and a desire to contribute to a vibrant community, we encourage you to apply!
                </p>

                <h3 className="text-3xl font-bold mb-4 text-purple-600">Current Openings:</h3>
                <ul className="list-disc list-inside space-y-4 text-lg mb-8 text-gray-700">
                    <li>
                        <strong>Pilot (Experienced / Cadet)</strong>
                        <p className="text-gray-600 text-base ml-4">
                            Fly our modern fleet across various routes. Requires strong communication and adherence to procedures.
                        </p>
                    </li>
                    <li>
                        <strong>Air Traffic Controller (ATC)</strong>
                        <p className="text-gray-600 text-base ml-4">
                            Guide our aircraft safely through the skies. Requires excellent situational awareness.
                        </p>
                    </li>
                    <li>
                        <strong>Ground Staff</strong>
                        <p className="text-gray-600 text-base ml-4">
                            Ensure smooth operations on the ground, from baggage handling to boarding.
                        </p>
                    </li>
                    <li>
                        <strong>Discord Server Moderator</strong>
                        <p className="text-gray-600 text-base ml-4">
                            Help manage our community, ensuring a friendly and engaging environment.
                        </p>
                    </li>
                </ul>

                <h3 className="text-3xl font-bold mb-4 text-purple-600">How to Apply:</h3>
                <p className="text-lg leading-relaxed mb-6 text-gray-700">
                    Please visit our official Discord server and navigate to the #careers channel for detailed application instructions
                    and to fill out the application form. We look forward to reviewing your application!
                </p>
                <a
                    href="#" // Replace with your Discord invite link
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-50"
                >
                    Join our Discord Server
                </a>
            </div>
        </div>
    );

    const PhotoAlbumPage = () => {
        const [photos, setPhotos] = useState([]); // Now fetched from Firestore

        // Fetch photos in real-time
        useEffect(() => {
            if (!db || !isAuthReady) return;

            const photosCollectionRef = collection(db, `artifacts/${appId}/public/data/photos`);
            const q = query(photosCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedPhotos = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate()); // Sort by most recent
                setPhotos(fetchedPhotos);
                console.log("Photos fetched:", fetchedPhotos);
            }, (error) => {
                console.error("Error fetching photos:", error);
                showTemporaryMessage('error', 'Failed to load photos.');
            });

            return () => unsubscribe();
        }, [db, isAuthReady]);

        return (
            <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
                <h2 className="text-5xl font-bold text-center mb-8 text-orange-600">Photo Album (Arrivals)</h2>
                <div className="max-w-6xl mx-auto p-8 bg-white rounded-xl shadow-md border border-teal-200">
                    <p className="text-lg text-center mb-8 leading-relaxed text-gray-700">
                        A glimpse into our operations and the beautiful moments captured during our flights and arrivals.
                        Each photo tells a story of our journeys across the virtual skies.
                    </p>
                    {photos.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {photos.map((photo) => (
                                <div key={photo.id} className="bg-gray-100 rounded-xl shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col md:flex-row border border-gray-200">
                                    <img
                                        src={photo.src}
                                        alt={photo.title}
                                        className="w-full md:w-1/2 h-56 md:h-auto object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/D1D5DB/4B5563?text=Image+Load+Error`; }}
                                    />
                                    <div className="p-6 flex-grow">
                                        <h3 className="font-bold text-2xl mb-3 text-teal-600">{photo.title}</h3>
                                        <p className="text-gray-700 text-lg leading-relaxed">{photo.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 text-lg">No photos available yet. Check back soon!</p>
                    )}
                </div>
            </div>
        );
    };

    const SupportPage = () => {
        const [formData, setFormData] = useState({
            discordUser: '',
            robloxUser: '',
            subject: '',
            message: ''
        });
        const [isSubmitted, setIsSubmitted] = useState(false);
        const [isLoading, setIsLoading] = useState(false);

        const handleChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            setIsLoading(true); // Set loading state

            if (!db || !auth.currentUser) {
                showTemporaryMessage('error', 'Firestore not ready or user not authenticated.');
                console.error("Firestore not ready or user not authenticated for support request.");
                setIsLoading(false);
                return;
            }

            try {
                const supportRequestsCollectionRef = collection(db, `artifacts/${appId}/public/data/supportRequests`);
                await addDoc(supportRequestsCollectionRef, {
                    ...formData,
                    timestamp: serverTimestamp(),
                    userId: auth.currentUser.uid, // Store the user's ID who made the support request
                });

                setIsSubmitted(true);
                showTemporaryMessage('success', 'Your support enquiry has been sent! We will get back to you soon via Discord.');
                setFormData({ discordUser: '', robloxUser: '', subject: '', message: '' }); // Reset form
            } catch (error) {
                console.error('Error sending support request to Firestore:', error);
                showTemporaryMessage('error', `Failed to send support request: ${error.message}`);
            } finally {
                setIsLoading(false); // End loading state
                setTimeout(() => {
                    setIsSubmitted(false);
                }, 3000);
            }
        };

        return (
            <div className="bg-gray-50 text-gray-800 min-h-screen p-8 rounded-xl shadow-lg">
                <h2 className="text-5xl font-bold text-center mb-8 text-orange-600">Support & Enquiries</h2>
                <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-md border border-blue-200">
                    {isSubmitted && !isLoading ? (
                        <div className="text-center text-green-600 text-3xl font-bold animate-pulse">
                            Enquiry Sent! Thank you for reaching out.
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="discordUser" className="block text-lg font-medium text-gray-700 mb-2">Your Discord User:</label>
                                <input
                                    type="text"
                                    id="discordUser"
                                    name="discordUser"
                                    value={formData.discordUser}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                    placeholder="e.g., YourUsername#1234"
                                />
                            </div>
                            <div>
                                <label htmlFor="robloxUser" className="block text-lg font-medium text-gray-700 mb-2">Your Roblox User:</label>
                                <input
                                    type="text"
                                    id="robloxUser"
                                    name="robloxUser"
                                    value={formData.robloxUser}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                    placeholder="e.g., YourRobloxUsername"
                                />
                            </div>
                            <div>
                                <label htmlFor="subject" className="block text-lg font-medium text-gray-700 mb-2">Subject:</label>
                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                    placeholder="e.g., Booking Enquiry, Partnership"
                                />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-lg font-medium text-gray-700 mb-2">Message:</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    rows="6"
                                    className="w-full p-3 rounded-lg bg-gray-100 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                                    placeholder="Type your detailed message here..."
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading} // Disable button when loading
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Sending...' : 'Send Enquiry'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    };

    // Render the current page based on state
    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <HomePage />;
            case 'booking':
                return <BookingPage />;
            case 'staffLogin':
                return <StaffLoginPage onLoginSuccess={() => { setIsStaffLoggedIn(true); navigate('staffDashboard'); }} />;
            case 'staffDashboard':
                return isStaffLoggedIn ? <StaffDashboardPage /> : <StaffLoginPage onLoginSuccess={() => { setIsStaffLoggedIn(true); navigate('staffDashboard'); }} />;
            case 'careers':
                return <CareersPage />;
            case 'photoAlbum':
                return <PhotoAlbumPage />;
            case 'support':
                return <SupportPage />;
            default:
                return <HomePage />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 font-inter">
            {/* Tailwind CSS Script - MUST be loaded */}
            <script src="https://cdn.tailwindcss.com"></script>
            {/* Inter font for a modern look */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
            <style>
                {`
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: #F3F4F6; /* Light background for overall app */
                }
                .font-inter {
                    font-family: 'Inter', sans-serif;
                }
                /* Custom scrollbar for a clean feel */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #E5E7EB; /* Lighter track */
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb {
                    background: #F97316; /* Orange thumb */
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #EA580C; /* Darker orange on hover */
                }
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                }
                .animate-fade-in-down {
                    animation: fadeInDown 0.5s ease-out forwards;
                }
                .animate-bounce {
                    animation: bounce 1s infinite;
                }
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes bounce {
                    0%, 100% {
                        transform: translateY(-5%);
                        animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
                    }
                    50% {
                        transform: translateY(0);
                        animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
                    }
                }
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: .5;
                    }
                }
                `}
            </style>

            <Navbar />
            <main className="container mx-auto px-4 py-8">
                {showMessage.visible && (
                    <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl text-white font-bold z-50 animate-fade-in-down
                        ${showMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {showMessage.text}
                    </div>
                )}
                {renderPage()}
            </main>
            <Footer />
        </div>
    );
};

export default App;
