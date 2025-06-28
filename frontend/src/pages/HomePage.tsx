import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import SearchBar from "../components/SearchBar";

const HomePage: React.FC = () => {
    return (
        <div className="p-4 md:p-8" data-theme="dark">

            <div className="text-center">
                <h1 className="text-4xl font-bold">Add new album to your collection</h1>
                <p className="py-6">
                    Use the search bar below to find and add new albums.
                </p>
                <SearchBar />
            </div>
            <ToastContainer />
        </div>
    );
};

export default HomePage;
