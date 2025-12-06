import { Link } from 'react-router'


const Hero = () => {
    return (
        <div className="hero min-h-screen"
            style={
                { backgroundImage: "url(/images/hero_bg_matched.png)" }
            }>
            <div className="hero-overlay bg-opacity-60"></div>
            <div className="hero-content text-neutral-content text-center">
                <div className="max-w-md">
                    <div className="flex flex-col items-center mb-5">
                        <img src="/icons/icon-192x192.png" alt="Musivault Logo" className="w-32 h-32 rounded-2xl shadow-2xl mb-4" />
                        <h1 className="text-5xl font-bold">MUSIVAULT</h1>
                    </div>
                    <p className="mb-5 text-lg font-medium">
                        Your music collection, reimagined. <br />
                        Catalog vinyls & CDs easily.
                    </p>
                    <Link to="/login" className="btn btn-primary">Get Started</Link>
                </div>
            </div>
        </div>
    )
}

export default Hero
