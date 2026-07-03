 const  Footer = () => {
    // console.log("testing ")
    return (
        <footer
            className="text-right text-sm text-white/60 px-4 sm:px-6 lg:px-8 py-4 mt-auto bg-violet-500/70"
            style={{ backgroundColor: "" }}
        >
            Copyright &copy; {new Date().getFullYear()} Actowiz Solutions All Rights Reserved
        </footer>
    );
}
export default Footer;