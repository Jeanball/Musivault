import { Link } from 'react-router'


const Hero = () => {
    return (
        <div className="hero min-h-screen"
            style={
                {backgroundImage: "url(https://img.daisyui.com/images/stock/photo-1507358522600-9f71e620c44e.webp)"}
        }>
            <div className="hero-overlay bg-opacity-60"></div>
            <div className="hero-content text-neutral-content text-center">
                <div className="max-w-md">
                    <h1 className="mb-5 text-5xl font-bold">MUSIVAULT</h1>
                    <p className="mb-5">
                        Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem
                        quasi. In deleniti eaque aut repudiandae et a id nisi.
                    </p>
                    <Link to="/login" className="btn btn-primary">Get Started</Link>
                </div>
            </div>
        </div>
    )
}

export default Hero
