namespace Manifold {

    export class ExternalResource implements Manifesto.IExternalResource {

        public clickThroughService: Manifesto.IService;
        public data: any;
        public dataUri: string;
        public error: any;
        public height: number;
        public index: number;
        public isResponseHandled: boolean = false;
        public loginService: Manifesto.IService;
        public logoutService: Manifesto.IService;
        public restrictedService: Manifesto.IService;
        public status: number;
        public tokenService: Manifesto.IService;
        public width: number;
        public x: number;
        public y: number;
        public isCORSEnabled: boolean;

        constructor(resource: Manifesto.IManifestResource, dataUriFunc: (r: Manifesto.IManifestResource) => string, isCORSEnabled: boolean = true) {
            resource.externalResource = this;
            this.isCORSEnabled = isCORSEnabled;
            this.dataUri = dataUriFunc(resource);
            this._parseAuthServices(resource);
        }

        private _parseAuthServices(resource: any): void {
            this.clickThroughService = manifesto.Utils.getService(resource, manifesto.ServiceProfile.clickThrough().toString());
            this.loginService = manifesto.Utils.getService(resource, manifesto.ServiceProfile.login().toString());
            this.restrictedService = manifesto.Utils.getService(resource, manifesto.ServiceProfile.restricted().toString());

            // todo: create this.preferredService?
            if (this.clickThroughService){
                this.logoutService = this.clickThroughService.getService(manifesto.ServiceProfile.logout().toString());
                this.tokenService = this.clickThroughService.getService(manifesto.ServiceProfile.token().toString());
            } else if (this.loginService){
                this.logoutService = this.loginService.getService(manifesto.ServiceProfile.logout().toString());
                this.tokenService = this.loginService.getService(manifesto.ServiceProfile.token().toString());
            } else if (this.restrictedService) {
                this.logoutService = this.restrictedService.getService(manifesto.ServiceProfile.logout().toString());
                this.tokenService = this.restrictedService.getService(manifesto.ServiceProfile.token().toString());
            }
        }

        public isAccessControlled(): boolean {
            if(this.clickThroughService || this.loginService || this.restrictedService){
                return true;
            }
            return false;
        }

        public hasServiceDescriptor(): boolean {
            return this.dataUri.endsWith('info.json');
        }

        private imageInfoIsLoaded(data, resolve) {

            // if it's a resource without an info.json
            // todo: if resource doesn't have a @profile
            if (!data){
                this.status = HTTPStatusCode.OK;
                resolve(this);
            } else {
                var uri = unescape(data['@id']);

                this.data = data;
                this._parseAuthServices(this.data);

                // remove trailing /info.json
                if (uri.endsWith('/info.json')){
                    uri = uri.substr(0, uri.lastIndexOf('/'));
                }

                var dataUri = this.dataUri;

                if (dataUri.endsWith('/info.json')){
                    dataUri = dataUri.substr(0, dataUri.lastIndexOf('/'));
                }

                // if the request was redirected to a degraded version and there's a login service to get the full quality version
                if (uri !== dataUri && this.loginService){
                    this.status = HTTPStatusCode.MOVED_TEMPORARILY;
                } else {
                    this.status = HTTPStatusCode.OK;
                }

                resolve(this);
            }

        }

        private imageInfoHandleError(error, resolve) {
            this.status = error.status;
            this.error = error;
            if (error.responseJSON){
                this._parseAuthServices(error.responseJSON);
            }
            resolve(this);
        }

        public getData(accessToken?: Manifesto.IAccessToken): Promise<Manifesto.IExternalResource> {

            return new Promise<Manifesto.IExternalResource>((resolve, reject) => {

                // check if dataUri ends with info.json
                // if not issue a HEAD request.

                var type: string = 'GET';

                if (!this.hasServiceDescriptor()){
                    // If access control is unnecessary, short circuit the process.
                    // Note that isAccessControlled check for short-circuiting only
                    // works in the "binary resource" context, since in that case,
                    // we know about access control from the manifest. For image
                    // resources, we need to check info.json for details and can't
                    // short-circuit like this.
                    if (!this.isAccessControlled()) {
                        this.status = HTTPStatusCode.OK;
                        resolve(this);
                        return;
                    }
                    type = 'HEAD';
                }

                if (this.isCORSEnabled) {

                    $.ajax(<JQueryAjaxSettings>{
                        url: this.dataUri,
                        type: type,
                        dataType: 'json',
                        xhrFields: { withCredentials: true },
                        beforeSend: (xhr) => {
                            if (accessToken) {
                                xhr.setRequestHeader("Authorization", "Bearer " + accessToken.accessToken);
                            }
                        }
                    }).done((data) => {
                        this.imageInfoIsLoaded(data, resolve);
                    }).fail((error) => {
                        this.imageInfoHandleError(error, resolve);
                    });


                } else {

                    var settings: JQueryAjaxSettings = <JQueryAjaxSettings>{
                        url: this.dataUri,
                        type: 'GET',
                        dataType: 'jsonp',
                        jsonp: 'callback',
                        jsonpCallback: 'imageInfoCallback'
                    };
                    $.ajax(settings);
                    window.imageInfoCallback = (json: any) => {
                        this.imageInfoIsLoaded(json, resolve);
                    };


                }


            });
        }
    }
}