 const  Footer = () => {
    return (
        <footer
            className="text-right text-sm text-white/60 px-4 sm:px-6 lg:px-8 py-4 mt-auto"
            style={{ backgroundColor: "#3F4D67" }}
        >
            Copyright &copy; {new Date().getFullYear()} Actowiz Solutions All Rights Reserved
        </footer>
    );
}
export default Footer;