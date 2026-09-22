#include <iostream>
#include <httplib.h>

int main() {
    httplib::Server svr;

    // Example API route
    svr.Get("/api/hello", [](const httplib::Request& req, httplib::Response& res) {
        res.set_content("{\"message\": \"Hello from C++ Backend!\"}", "application/json");
    });

    // Mount the React static build directory.
    // In Vite/Nitro, this is ".output/public"
    svr.set_mount_point("/", "../.output/public");
    
    // SPA fallback (Return index.html for 404s, assuming they are client-side routes)
    svr.set_error_handler([](const httplib::Request& req, httplib::Response& res) {
        if (res.status == 404) {
            // Serve index.html for SPA routing
            res.status = 200;
            
            // Read index.html from .output/public folder
            std::string path = "../.output/public/index.html";
            std::ifstream file(path);
            if (file.is_open()) {
                std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
                res.set_content(content, "text/html");
            } else {
                res.status = 404;
                res.set_content("404 Not Found (and index.html missing)", "text/plain");
            }
        }
    });

    std::cout << "Starting C++ Server on http://localhost:8080" << std::endl;
    std::cout << "Serving static files from '../.output/public'" << std::endl;
    
    svr.listen("0.0.0.0", 8080);

    return 0;
}
