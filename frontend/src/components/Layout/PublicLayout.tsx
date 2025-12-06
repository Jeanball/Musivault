import { Outlet } from 'react-router';

const PublicLayout = () => {
    return (
        <div data-theme="dark" className="bg-base-100 min-h-screen text-base-content">
            <Outlet />
        </div>
    );
};

export default PublicLayout;
